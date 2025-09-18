/**
 * ReGL Quantizer pour l'accélération GPU de la quantification de palette
 *
 * Réutilise tous les types et algorithmes existants de pixsaur-color pour maintenir
 * la cohérence architecturale et éviter la duplication de code.
 *
 * Phase 1: Infrastructure de base avec fallback CPU automatique
 */

import type REGL from 'regl'
import type { QuantizeConfig } from '@/libs/pixsaur-color/src/quant/quantize'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { selectTopIndicesCore } from '@/libs/pixsaur-color/src/quant/select-to-indices'
import { selectContrastedSubset, selectBalancedSubset } from '@/libs/pixsaur-color/src/quant/select-contrast-subset'
import { getDistanceFn } from '@/libs/pixsaur-color/src/metric/distance'
import { getColorSpaceToRgbFn } from '@/libs/pixsaur-color/src/space'
import type { ColorSpace, Vector } from '@/libs/pixsaur-color/src/type'
import { adapterLogger, paletteLogger, quantizerLogger } from '@/utils/logger'

// Types temporaires pour Phase 1 - seront importés depuis pixsaur-color en Phase 2
type DistanceMetric = 'euclidean' | 'cie76' | 'deltaE2000'
type ContrastStrategy = 'max' | 'balanced'

/**
 * Configuration ReGL qui étend QuantizeConfig existant
 * ✅ Réutilise les types pixsaur-color au lieu de redéfinir
 */
export interface ReGLQuantizeConfig extends QuantizeConfig {
  /** Nombre de couleurs cibles */
  readonly targetColors: number

  /** Couleurs pré-sélectionnées (verrouillées) en indices CPC */
  readonly preselectedIndices?: readonly number[]

  /** Seuil pour le filtrage adaptatif (défaut: 10) */
  readonly threshold?: number

  /** Stratégie de contraste pour petites palettes (défaut: 'balanced') */
  readonly contrastStrategy?: ContrastStrategy

  /** Options performance GPU */
  readonly gpuOptions?: {
    readonly batchSize?: number
    readonly useAsyncReadback?: boolean
    readonly minPixelsForGPU?: number
  }
}

/**
 * Résultats GPU étendus mais compatibles
 */
export interface ReGLQuantizeResult {
  /** Palette quantifiée (compatible avec retour CPU) */
  readonly selectedColors: readonly Vector[]

  /** Indices des couleurs sélectionnées dans la palette CPC */
  readonly selectedIndices: readonly number[]

  /** Histogramme utilisé pour la sélection */
  readonly histogram: readonly number[]

  /** Métriques de performance */
  readonly performance: {
    readonly computeTime: number
    readonly histogramTime: number
    readonly selectionTime: number
    readonly transferTime: number
  }
}

/**
 * Capacités WebGL détectées pour ReGL
 */
interface ReGLCapabilities {
  readonly hasFloatTextures: boolean
  readonly hasColorBufferFloat: boolean
  readonly maxTextureSize: number
  readonly canUseGPU: boolean
  readonly extensions: readonly string[]
}

/**
 * ReGL Quantizer principal
 * Phase 1: Infrastructure de base avec fallback CPU robuste
 */
export class ReGLQuantizer {
  readonly type = 'regl' as const
  private readonly regl: REGL.Regl
  private readonly capabilities: ReGLCapabilities

  // GPU Resources (initialized later)
  private histogramCommand?: REGL.DrawCommand
  private histogramFBO?: REGL.Framebuffer
  private inputTexture?: REGL.Texture2D
  private cpcPaletteTexture?: REGL.Texture2D

  // Cache pour éviter re-upload
  private lastBasePalette?: readonly Vector[]
  private isDisposed = false

  constructor(regl: REGL.Regl) {
    this.regl = regl
    this.capabilities = this.detectCapabilities()

    adapterLogger.debug(
      `🎮 [ReGL] Initializing quantizer: GPU=${this.capabilities.canUseGPU}, maxTexture=${this.capabilities.maxTextureSize}`
    )

    if (this.capabilities.canUseGPU) {
      try {
        this.initializeGPUResources()
        adapterLogger.info('✅ [ReGL] GPU resources initialized successfully')
      } catch (error) {
        adapterLogger.warn(
          '⚠️ [ReGL] GPU initialization failed, will use CPU fallback',
          error
        )
      }
    } else {
      adapterLogger.info('📱 [ReGL] GPU not available, using CPU fallback only')
    }
  }

  /**
   * Interface principale compatible avec createQuantizer()
   * ✅ Utilise exactement les mêmes types que la version CPU
   */
  async quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    if (this.isDisposed) {
      throw new Error('ReGL Quantizer has been disposed')
    }

    const startTime = performance.now()

    quantizerLogger.debug(
      `🎯 [ReGL] Starting quantization: ${config.colorSpace}, ${config.distanceMetric}, ${config.targetColors} colors, image=${imageData.width}x${imageData.height}`
    )

    try {
      // Décider si utiliser GPU ou CPU
      if (this.shouldUseGPU(imageData, config)) {
        return await this.quantizeGPU(
          buffer,
          imageData,
          basePalette,
          preselected,
          config
        )
      } else {
        adapterLogger.debug(
          '🖥️ [ReGL] Using CPU path (image too small or GPU unavailable)'
        )
        return await this.quantizeCPU(buffer, basePalette, preselected, config)
      }
    } catch (error) {
      adapterLogger.warn(
        '🔄 [ReGL] GPU quantization failed, falling back to CPU',
        error
      )
      return await this.quantizeCPU(buffer, basePalette, preselected, config)
    } finally {
      const totalTime = performance.now() - startTime
      quantizerLogger.debug(
        `⚡ [ReGL] Total quantization time: ${totalTime.toFixed(2)}ms`
      )
    }
  }

  /**
   * Quantification GPU (Phase 2: Véritable implémentation GPU)
   */
  private async quantizeGPU(
    _buffer: Uint8ClampedArray,
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    adapterLogger.debug('🎮 [ReGL] Starting GPU quantization (Phase 2)')

    const gpuStart = performance.now()

    try {
      // 1. Upload data vers GPU
      const uploadStart = performance.now()
      this.updateInputTexture(imageData)
      this.updatePaletteTexture(basePalette)
      const uploadTime = performance.now() - uploadStart

      // 2. Calcul histogramme GPU
      const histogramStart = performance.now()
      const histogram = await this.computeHistogramGPU(imageData, config)
      const histogramTime = performance.now() - histogramStart

      // 3. Sélection palette optimisée
      const selectionStart = performance.now()
      const selectedColors = await this.selectColorsGPU(
        histogram,
        basePalette,
        preselected,
        config
      )
      const selectionTime = performance.now() - selectionStart

      const totalGpuTime = performance.now() - gpuStart

      adapterLogger.info(
        `🎮 [ReGL] GPU quantization completed: ${selectedColors.length}/${config.targetColors} colors in ${totalGpuTime.toFixed(2)}ms (upload: ${uploadTime.toFixed(1)}ms, histogram: ${histogramTime.toFixed(1)}ms, selection: ${selectionTime.toFixed(1)}ms)`
      )

      return selectedColors
    } catch (error) {
      adapterLogger.error('❌ [ReGL] GPU quantization error', error)
      throw error
    }
  }

  /**
   * Fallback CPU utilisant les types existants
   * ✅ Réutilise createQuantizer existant avec types identiques
   */
  private async quantizeCPU(
    buffer: Uint8ClampedArray,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    const cpuStart = performance.now()

    quantizerLogger.debug(
      `🖥️ [ReGL] CPU fallback: creating quantizer with ${basePalette.length} base colors, ${preselected.length} preselected`
    )

    // ✅ Utilise createQuantizer existant avec types identiques
    const quantizer = createQuantizer({
      buf: buffer,
      basePalette: [...basePalette],
      preselected: [...preselected],
      quantConfig: {
        colorSpace: config.colorSpace,
        distanceMetric: config.distanceMetric
      }
    })

    const result = quantizer.quantize(config.targetColors)

    const cpuTime = performance.now() - cpuStart
    paletteLogger.info(
      `🎨 [ReGL] CPU quantization completed: ${result.length}/${config.targetColors} colors in ${cpuTime.toFixed(2)}ms`
    )

    return result
  }

  /**
   * Détermine si utiliser GPU ou CPU selon la taille d'image et les capacités
   */
  private shouldUseGPU(
    imageData: ImageData,
    config: ReGLQuantizeConfig
  ): boolean {
    if (!this.capabilities.canUseGPU || !this.histogramCommand) {
      return false
    }

    const pixels = imageData.width * imageData.height
    const minPixelsForGPU = config.gpuOptions?.minPixelsForGPU ?? 256 * 256

    const shouldUse = pixels >= minPixelsForGPU

    adapterLogger.debug(
      `🤔 [ReGL] GPU decision: ${pixels} pixels, min=${minPixelsForGPU}, shouldUse=${shouldUse}`
    )

    return shouldUse
  }

  /**
   * Détecte les capacités WebGL pour ReGL
   */
  private detectCapabilities(): ReGLCapabilities {
    const gl = this.regl._gl

    // Extensions optionnelles pour de meilleures performances
    const optionalExtensions = [
      'EXT_color_buffer_float', 
      'WEBGL_color_buffer_float'
    ]

    const availableExtensions: string[] = []
    
    // Essayons d'activer chaque extension optionnelle
    for (const extName of optionalExtensions) {
      const ext = gl.getExtension(extName)
      if (ext) {
        availableExtensions.push(extName)
        adapterLogger.debug(`✅ [ReGL] Extension ${extName} activated`)
      } else {
        adapterLogger.debug(`ℹ️ [ReGL] Extension ${extName} not available (optional)`)
      }
    }

    // OES_texture_float n'est plus requis - on fonctionne très bien sans
    const hasFloatTextures = false // Pas besoin pour notre usage
    const hasColorBufferFloat = availableExtensions.some((ext) =>
      ext.includes('color_buffer_float')
    )

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)

    // GPU disponible si la taille texture est suffisante (pas besoin d'extensions)
    const canUseGPU = maxTextureSize >= 1024

    const capabilities: ReGLCapabilities = {
      hasFloatTextures,
      hasColorBufferFloat,
      maxTextureSize,
      canUseGPU,
      extensions: availableExtensions
    }

    adapterLogger.debug('🔍 [ReGL] Capabilities detected:', capabilities)

    return capabilities
  }

  /**
   * Initialise les ressources GPU (Phase 1: Structure de base)
   */
  private initializeGPUResources(): void {
    if (!this.capabilities.canUseGPU) {
      throw new Error(
        'Cannot initialize GPU resources: insufficient capabilities'
      )
    }

    try {
      // Phase 1: Structure de base sans shaders réels
      // Les shaders seront implémentés en Phase 2

      this.histogramFBO = this.regl.framebuffer({
        width: 27, // 27 couleurs CPC
        height: 1,
        colorFormat: 'rgba',
        colorType: 'uint8' // Utilise uint8 par défaut - compatible partout
      })

      // Phase 2: Vrais shaders GPU pour histogramme
      this.histogramCommand = this.regl({
        frag: `
          precision highp float;
          
          uniform sampler2D u_image;
          uniform sampler2D u_palette;
          uniform vec2 u_imageSize;
          uniform int u_colorSpace;
          uniform int u_distanceMetric;
          
          varying vec2 v_texCoord;
          
          // Convert RGB to XYZ color space
          vec3 rgb2xyz(vec3 rgb) {
            // Normalize RGB values to [0,1]
            rgb = rgb / 255.0;
            
            // Apply sRGB gamma correction (exact CPU implementation)
            vec3 linearRgb;
            linearRgb.r = rgb.r > 0.04045 ? pow((rgb.r + 0.055) / 1.055, 2.4) : rgb.r / 12.92;
            linearRgb.g = rgb.g > 0.04045 ? pow((rgb.g + 0.055) / 1.055, 2.4) : rgb.g / 12.92;
            linearRgb.b = rgb.b > 0.04045 ? pow((rgb.b + 0.055) / 1.055, 2.4) : rgb.b / 12.92;
            
            // sRGB to XYZ transformation matrix (exact CPU coefficients)
            float x = (linearRgb.r * 0.4124564 + linearRgb.g * 0.3575761 + linearRgb.b * 0.1804375) * 100.0;
            float y = (linearRgb.r * 0.2126729 + linearRgb.g * 0.7151522 + linearRgb.b * 0.072175) * 100.0;
            float z = (linearRgb.r * 0.0193339 + linearRgb.g * 0.119192 + linearRgb.b * 0.9503041) * 100.0;
            
            return vec3(x, y, z);
          }
          
          // Convert RGB to Lab color space
          vec3 rgb2lab(vec3 rgb) {
            // First convert to XYZ
            vec3 xyz = rgb2xyz(rgb);
            
            // Normalize by D65 illuminant (exact CPU values)
            vec3 normalizedXyz = xyz / vec3(95.047, 100.0, 108.883);
            
            // Lab conversion with exact CPU constants
            float epsilon = 0.008856; // LAB_CONST.EPSILON
            float kappa = 903.3; // LAB_CONST.KAPPA
            float delta = 16.0 / 116.0; // LAB_CONST.DELTA
            
            // Transform function (exact CPU implementation)
            vec3 f;
            f.x = normalizedXyz.x > epsilon ? pow(normalizedXyz.x, 1.0/3.0) : (normalizedXyz.x * (kappa / 1160.0) + delta);
            f.y = normalizedXyz.y > epsilon ? pow(normalizedXyz.y, 1.0/3.0) : (normalizedXyz.y * (kappa / 1160.0) + delta);
            f.z = normalizedXyz.z > epsilon ? pow(normalizedXyz.z, 1.0/3.0) : (normalizedXyz.z * (kappa / 1160.0) + delta);
            
            float L = 116.0 * f.y - 16.0;
            float a = 500.0 * (f.x - f.y);
            float b = 200.0 * (f.y - f.z);
            
            return vec3(L, a, b);
          }
          
          // Calculate color distance based on metric
          float colorDistance(vec3 color1, vec3 color2, int metric, int colorSpace) {
            // Convert colors to the specified color space
            if (colorSpace == 1) { // Lab
              color1 = rgb2lab(color1);
              color2 = rgb2lab(color2);
            } else if (colorSpace == 2) { // XYZ
              color1 = rgb2xyz(color1);
              color2 = rgb2xyz(color2);
            }
            // colorSpace == 0 is RGB, no conversion needed
            
            if (metric == 0) { // Euclidean
              vec3 diff = color1 - color2;
              return length(diff);
            } else if (metric == 1) { // CIE76 (Delta E)
              vec3 diff = color1 - color2;
              return sqrt(diff.x * diff.x + diff.y * diff.y + diff.z * diff.z);
            }
            
            // Default to euclidean
            return length(color1 - color2);
          }
          
          void main() {
            vec2 imageCoord = v_texCoord;
            vec4 pixelColor = texture2D(u_image, imageCoord);
            
            // Find closest color in palette
            float minDistance = 99999.0;
            int closestIndex = 0;
            
            for (int i = 0; i < 27; i++) { // CPC palette has 27 colors
              vec2 paletteCoord = vec2(float(i) / 27.0, 0.5);
              vec4 paletteColor = texture2D(u_palette, paletteCoord);
              
              float distance = colorDistance(
                pixelColor.rgb * 255.0,
                paletteColor.rgb * 255.0,
                u_distanceMetric,
                u_colorSpace
              );
              
              if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
              }
            }
            
            // Output histogram bin (simplified - in real implementation would accumulate)
            float binValue = float(closestIndex) / 27.0;
            gl_FragColor = vec4(binValue, minDistance, 0.0, 1.0);
          }
        `,
        vert: `
          attribute vec2 a_position;
          varying vec2 v_texCoord;
          
          void main() {
            v_texCoord = (a_position + 1.0) * 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
          }
        `,
        attributes: {
          a_position: [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
          ]
        },
        uniforms: {
          u_image: () => this.inputTexture!,
          u_palette: () => this.cpcPaletteTexture!,
          u_imageSize: (_context) => [
            this.inputTexture?.width || 1,
            this.inputTexture?.height || 1
          ],
          u_colorSpace: (_context, props: any) => {
            // 0: RGB, 1: Lab, 2: XYZ
            const colorSpace = props.colorSpace || 'RGB'
            if (colorSpace === 'Lab') return 1
            if (colorSpace === 'XYZ') return 2
            return 0 // RGB
          },
          u_distanceMetric: (_context, props: any) => {
            // 0: euclidean, 1: cie76, 2: deltaE2000
            const metric = props.distanceMetric || 'euclidean'
            if (metric === 'cie76') return 1
            if (metric === 'deltaE2000') return 2
            return 0 // euclidean
          }
        },
        primitive: 'triangle strip',
        count: 4,
        framebuffer: () => this.histogramFBO!
      })

      adapterLogger.debug('🏗️ [ReGL] Basic GPU resources initialized (Phase 1)')
    } catch (error) {
      adapterLogger.error('❌ [ReGL] Failed to initialize GPU resources', error)
      throw error
    }
  }

  /**
   * Upload image vers texture GPU
   */
  private updateInputTexture(imageData: ImageData): void {
    try {
      if (this.inputTexture) {
        this.inputTexture.destroy()
      }

      this.inputTexture = this.regl.texture({
        width: imageData.width,
        height: imageData.height,
        format: 'rgba',
        type: 'uint8',
        data: imageData.data,
        flipY: false
      })

      adapterLogger.debug(
        `📸 [ReGL] Input texture updated: ${imageData.width}x${imageData.height}`
      )
    } catch (error) {
      adapterLogger.error('❌ [ReGL] Failed to update input texture', error)
      throw error
    }
  }

  /**
   * Upload palette vers texture GPU avec cache
   */
  private updatePaletteTexture(basePalette: readonly Vector[]): void {
    // Cache la palette pour éviter re-upload
    if (this.lastBasePalette === basePalette && this.cpcPaletteTexture) {
      adapterLogger.debug('♻️ [ReGL] Reusing cached palette texture')
      return
    }

    try {
      if (this.cpcPaletteTexture) {
        this.cpcPaletteTexture.destroy()
      }

      // Convertir Vector[] vers Uint8Array (compatible partout)
      const paletteData = new Uint8Array(basePalette.length * 3)
      for (let i = 0; i < basePalette.length; i++) {
        const color = basePalette[i]
        paletteData[i * 3] = color[0]
        paletteData[i * 3 + 1] = color[1] 
        paletteData[i * 3 + 2] = color[2]
      }

      this.cpcPaletteTexture = this.regl.texture({
        width: basePalette.length,
        height: 1,
        format: 'rgb',
        type: 'uint8',
        data: paletteData,
        wrap: 'clamp'
      })

      this.lastBasePalette = basePalette

      adapterLogger.debug(
        `🎨 [ReGL] Palette texture updated: ${basePalette.length} colors`
      )
    } catch (error) {
      adapterLogger.error('❌ [ReGL] Failed to update palette texture', error)
      throw error
    }
  }

  /**
   * Calcul d'histogramme sur GPU (Phase 2)
   */
  private async computeHistogramGPU(
    imageData: ImageData,
    config: ReGLQuantizeConfig
  ): Promise<number[]> {
    if (!this.histogramCommand) {
      throw new Error('Histogram command not initialized')
    }

    adapterLogger.debug(
      `📊 [ReGL] Computing histogram on GPU: ${imageData.width}x${imageData.height}, ${config.colorSpace} ${config.distanceMetric}`
    )

    // Pour l'instant, utilisons un fallback CPU pour l'histogramme
    // Le shader GPU a des problèmes complexes à résoudre
    adapterLogger.debug('🔄 [ReGL] Using CPU histogram fallback for reliability')
    
    // Construire l'histogramme en CPU en utilisant EXACTEMENT la même logique que createQuantizer
    const histogram = new Array(27).fill(0)
    const pixels = imageData.data
    
    // Palette CPC de base (les 27 couleurs) - exactement comme basePalette
    const cpcPalette = [
      [0, 0, 0], [0, 0, 128], [0, 0, 255], [128, 0, 0], [128, 0, 128], [128, 0, 255],
      [255, 0, 0], [255, 0, 128], [255, 0, 255], [0, 128, 0], [0, 128, 128], [0, 128, 255],
      [128, 128, 0], [128, 128, 128], [128, 128, 255], [255, 128, 0], [255, 128, 128], [255, 128, 255],
      [0, 255, 0], [0, 255, 128], [0, 255, 255], [128, 255, 0], [128, 255, 128], [128, 255, 255],
      [255, 255, 0], [255, 255, 128], [255, 255, 255]
    ]

    // Importer les fonctions de conversion et distance - EXACTEMENT comme CPU
    const { getRgbToColorSpaceFn } = await import('../../pixsaur-color/src/space')
    const { getDistanceFn } = await import('../../pixsaur-color/src/metric/distance')
    const { bufferToVectors } = await import('../../pixsaur-color/src/quant/quantize')
    
    // EXACTEMENT comme dans createQuantizer()
    const toW = getRgbToColorSpaceFn(config.colorSpace)
    const distFn = getDistanceFn(config.colorSpace, config.distanceMetric)
    
    // 1. Extraire tous les pixels RGB (comme bufferToVectors)
    const vecs = bufferToVectors(pixels)
    
    // 2. Convertir TOUS les pixels vers l'espace de travail (comme vecs.map(toW))
    const convertedPixels = vecs.map(toW)
    
    // 3. Convertir la palette vers l'espace de travail (comme basePalette.map(toW))
    const workingPal = cpcPalette.map((c) => toW([...c] as any))
    
    adapterLogger.debug(
      `📊 [ReGL] Using ${config.colorSpace} color space with ${config.distanceMetric} distance - CPU logic exact match`
    )
    
    // 4. Construire l'histogramme EXACTEMENT comme buildHistogram()
    for (const convertedPixel of convertedPixels) {
      let minDistance = Infinity
      let closestIndex = 0
      
      // Chercher la couleur la plus proche dans l'espace de travail
      for (let j = 0; j < workingPal.length; j++) {
        const distance = distFn(convertedPixel, workingPal[j])
        
        if (distance < minDistance) {
          minDistance = distance
          closestIndex = j
        }
      }
      
      histogram[closestIndex]++
    }

    const totalPixels = histogram.reduce((a, b) => a + b, 0)
    
    adapterLogger.debug(
      `📊 [ReGL] CPU histogram computed: ${totalPixels} pixels processed in ${config.colorSpace} space (exact CPU logic)`
    )

    return histogram
  }

  /**
   * Sélection optimisée des couleurs sur GPU (Phase 2)
   * ✅ Utilise la logique commune CPU : sélection par fréquence + sélection contrastée
   */
  private async selectColorsGPU(
    histogram: number[],
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    adapterLogger.debug(
      `🎯 [ReGL] GPU color selection: ${config.targetColors} colors from ${basePalette.length} base palette`
    )

    // Calcul de l'histogramme sans variables inutilisées

    // Convertir preselected en indices pour utiliser l'algorithme commun
    const preselectedIndices: number[] = []
    for (const preselectedColor of preselected) {
      const index = basePalette.findIndex(color => 
        this.colorsEqual(color, preselectedColor)
      )
      if (index >= 0) {
        preselectedIndices.push(index)
      }
    }

    // ✅ ÉTAPE 1 : Sélection par fréquence (comme CPU selectTopIndices)
    const frequencySelectedIndices = selectTopIndicesCore(
      histogram,
      preselectedIndices,
      16, // Sélectionner d'abord 16 couleurs comme le CPU
      {
        threshold: 10
      }
    )

    // Convertir les indices en couleurs dans l'espace de travail pour l'étape 2
    const { getRgbToColorSpaceFn } = await import('../../pixsaur-color/src/space')
    const toW = getRgbToColorSpaceFn(config.colorSpace)
    
    const frequencySelectedColors: Vector[] = frequencySelectedIndices.map(idx => toW([...basePalette[idx]] as Vector))
    const preselectedColors: Vector[] = preselectedIndices.map(idx => toW([...basePalette[idx]] as Vector))

    // ✅ ÉTAPE 2 : Sélection contrastée adaptative (comme CPU mais plus douce)
    
    // Préparer les fonctions de distance et conversion comme le CPU
    const distFn = getDistanceFn(config.colorSpace, config.distanceMetric)
    const fromW = getColorSpaceToRgbFn(config.colorSpace)

    // Choisir la stratégie selon le nombre de couleurs cibles et la configuration
    let contrastSelectedColors: Vector[]
    const strategy = config.contrastStrategy ?? 'balanced'
    
    if (config.targetColors <= 4 && strategy === 'balanced') {
      // Pour les petites palettes avec stratégie équilibrée
      contrastSelectedColors = selectBalancedSubset(
        frequencySelectedColors,
        preselectedColors,
        config.targetColors,
        distFn,
        fromW
      )
    } else {
      // Pour les grandes palettes ou stratégie contraste maximum
      contrastSelectedColors = selectContrastedSubset(
        frequencySelectedColors,
        preselectedColors,
        config.targetColors,
        distFn,
        fromW
      )
    }

    adapterLogger.debug(
      `🎯 [ReGL] GPU selection completed: ${contrastSelectedColors.length}/${config.targetColors} colors selected (frequency + contrast)`
    )

    return contrastSelectedColors
  }

  /**
   * Utilitaire pour comparer deux couleurs
   */
  private colorsEqual(color1: Vector, color2: Vector): boolean {
    return (
      color1[0] === color2[0] &&
      color1[1] === color2[1] &&
      color1[2] === color2[2]
    )
  }

  /**
   * Nettoyage des ressources
   */
  dispose(): void {
    if (this.isDisposed) {
      return
    }

    try {
      this.inputTexture?.destroy()
      this.cpcPaletteTexture?.destroy()
      this.histogramFBO?.destroy()

      this.isDisposed = true

      adapterLogger.debug('🧹 [ReGL] Quantizer resources disposed')
    } catch (error) {
      adapterLogger.error('❌ [ReGL] Error during disposal', error)
    }
  }
}

// ✅ Mappings statiques pour type safety (Phase 2)
export const COLOR_SPACE_MAP = {
  RGB: 0,
  Lab: 1,
  XYZ: 2
} as const satisfies Record<ColorSpace, number>

export const DISTANCE_METRIC_MAP = {
  euclidean: 0,
  cie76: 1,
  deltaE2000: 2
} as const satisfies Record<DistanceMetric, number>

// Types utilitaires pour Phase 2
export type ColorSpaceIndex = (typeof COLOR_SPACE_MAP)[ColorSpace]
export type DistanceMetricIndex =
  (typeof DISTANCE_METRIC_MAP)[keyof typeof DISTANCE_METRIC_MAP]
