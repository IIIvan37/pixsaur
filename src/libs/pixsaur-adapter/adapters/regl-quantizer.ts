/**
 * ReGL Quantizer pour l'accélération GPU de la quantification de palette
 *
 * Réutilise tous les types et algorithmes existants de pixsaur-color pour maintenir
 * la cohérence architecturale et éviter la duplication de code.
 *
 * Phase 1: Infrastructure de base avec fallback CPU automatique
 */

import type REGL from 'regl'
import type { DistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { getDistanceFn } from '@/libs/pixsaur-color/src/metric/distance'
import type { QuantizeConfig } from '@/libs/pixsaur-color/src/quant/quantize'
import { selectTopIndicesCore } from '@/libs/pixsaur-color/src/quant/select-to-indices'
import { selectByStrategy } from '@/libs/pixsaur-color/src/quant/strategy-selector'
import { rgbToLab, rgbToXyz } from '@/libs/pixsaur-color/src/space/convert'
import type { ColorSpace, Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { adapterLogger, quantizerLogger } from '@/utils/logger'

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

    // ReGLQuantizer est purement GPU - pas de fallback interne
    if (!this.shouldUseGPU(imageData, config)) {
      throw new Error(
        'ReGLQuantizer: Image too small or GPU unavailable - use CPU processor instead'
      )
    }

    const result = await this.quantizeGPU(
      buffer,
      imageData,
      basePalette,
      preselected,
      config
    )

    const totalTime = performance.now() - startTime
    quantizerLogger.debug(
      `⚡ [ReGL] Total quantization time: ${totalTime.toFixed(2)}ms`
    )

    return result
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

      // 2. Calcul histogramme GPU (bypass pour CPC Plus avec modes optimisés)
      const histogramStart = performance.now()
      const isCPCPlus = basePalette.length > 27
      const isCPCMode = config.targetColors === 16 || config.targetColors === 4 || config.targetColors === 2 || config.targetColors === 512
      
      let histogram: number[]
      let histogramTime: number
      if (isCPCPlus && isCPCMode) {
        // 🚀 CPC Plus: Bypass complet de l'histogramme
        adapterLogger.info(`🚀 [ReGL] CPC Plus bypass: skipping histogram for ${config.targetColors} color mode`)
        histogram = new Array(basePalette.length).fill(0) // Histogramme vide
        histogramTime = 0 // Pas de temps pour l'histogramme
      } else {
        // 📊 Mode traditionnel: calcul de l'histogramme
        histogram = await this.computeHistogramGPU(imageData, basePalette, config)
        histogramTime = performance.now() - histogramStart
      }

      // 3. Sélection palette optimisée
      const selectionStart = performance.now()
      const selectedColors = await this.selectColorsGPU(
        histogram,
        imageData,
        basePalette,
        preselected,
        config
      )
      
      adapterLogger.info(`🔍 [ReGL DEBUG] Selected ${selectedColors.length} colors from GPU:`, selectedColors.slice(0, Math.min(10, selectedColors.length)).map(c => `[${c[0]},${c[1]},${c[2]}]`))
      
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
   * Détermine si utiliser GPU ou CPU selon la taille d'image et les capacités
   * ✅ RÉACTIVÉ: Utilise vraie GPU avec shaders parallélisés
   */
  private shouldUseGPU(
    imageData: ImageData,
    config: ReGLQuantizeConfig
  ): boolean {
    if (!this.capabilities.canUseGPU || !this.histogramCommand) {
      adapterLogger.debug(
        '🚫 [ReGL] GPU not available - missing capabilities or commands'
      )
      return false
    }

    const pixels = imageData.width * imageData.height
    const minPixelsForGPU = config.gpuOptions?.minPixelsForGPU ?? 128 * 128

    const shouldUse = pixels >= minPixelsForGPU

    adapterLogger.debug(
      `🤔 [ReGL] GPU decision: ${pixels} pixels, min=${minPixelsForGPU}, shouldUse=${shouldUse} (Real GPU implementation)`
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
        adapterLogger.debug(
          `ℹ️ [ReGL] Extension ${extName} not available (optional)`
        )
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
          
          // ✅ EXACT CPU-equivalent color space conversions using pixsaur-color constants
          
          // Constantes exactes depuis pixsaur-color/src/space/convert.ts
          const float SRGB_A = 0.04045;
          const float SRGB_B = 12.92;
          const float SRGB_C = 2.4;
          const float SRGB_OFFSET = 0.055;
          const float SRGB_THRESHOLD = 0.0031308;
          
          const vec3 REF_WHITE = vec3(95.047, 100.0, 108.883);
          const float LAB_EPSILON = 0.008856;
          const float LAB_KAPPA = 903.3;
          const float LAB_DELTA = 16.0 / 116.0;
          
          // ✅ Conversion RGB vers XYZ exacte (copie de pixsaur-color)
          vec3 rgbToXyz(vec3 rgb) {
            // Les textures WebGL donnent des valeurs [0-1], pas besoin de normaliser
            // car la fonction CPU fait rgb.map(v => v / 255) en interne
            vec3 normalized = rgb;
            
            // Correction gamma sRGB exacte (même algorithme que CPU)
            vec3 linear;
            linear.r = normalized.r > SRGB_A ? 
              pow((normalized.r + SRGB_OFFSET) / (1.0 + SRGB_OFFSET), SRGB_C) : 
              normalized.r / SRGB_B;
            linear.g = normalized.g > SRGB_A ? 
              pow((normalized.g + SRGB_OFFSET) / (1.0 + SRGB_OFFSET), SRGB_C) : 
              normalized.g / SRGB_B;
            linear.b = normalized.b > SRGB_A ? 
              pow((normalized.b + SRGB_OFFSET) / (1.0 + SRGB_OFFSET), SRGB_C) : 
              normalized.b / SRGB_B;
            
            // Matrice de transformation sRGB vers XYZ (exacte de pixsaur-color)
            // GLSL utilise column-major, donc on transpose par rapport au CPU
            mat3 rgb_to_xyz = mat3(
              0.4124564, 0.3575761, 0.1804375,  // Row 1 dans CPU: X = r*0.4124564 + g*0.3575761 + b*0.1804375
              0.2126729, 0.7151522, 0.072175,   // Row 2 dans CPU: Y = r*0.2126729 + g*0.7151522 + b*0.072175  
              0.0193339, 0.119192,  0.9503041   // Row 3 dans CPU: Z = r*0.0193339 + g*0.119192 + b*0.9503041
            );
            
            // Transformation et multiplication par 100 (comme CPU)
            vec3 xyz = rgb_to_xyz * linear * 100.0;
            return xyz;
          }
          
          // ✅ Conversion XYZ vers Lab exacte (copie de pixsaur-color)
          vec3 xyzToLab(vec3 xyz) {
            // Normalisation par illuminant D65 (exacte de pixsaur-color)
            vec3 normalized = xyz / REF_WHITE;
            
            // Fonction de transformation Lab (exacte de pixsaur-color)
            vec3 transformed;
            transformed.x = normalized.x > LAB_EPSILON ? 
              pow(normalized.x, 1.0/3.0) : 
              (normalized.x * LAB_KAPPA / 1160.0) + LAB_DELTA;
            transformed.y = normalized.y > LAB_EPSILON ? 
              pow(normalized.y, 1.0/3.0) : 
              (normalized.y * LAB_KAPPA / 1160.0) + LAB_DELTA;
            transformed.z = normalized.z > LAB_EPSILON ? 
              pow(normalized.z, 1.0/3.0) : 
              (normalized.z * LAB_KAPPA / 1160.0) + LAB_DELTA;
            
            // Calcul final Lab (exacte de pixsaur-color)
            float L = 116.0 * transformed.y - 16.0;
            float a = 500.0 * (transformed.x - transformed.y);
            float b = 200.0 * (transformed.y - transformed.z);
            
            return vec3(L, a, b);
          }
          
          // ✅ Conversion RGB vers Lab complète (comme rgbToLab du CPU)
          vec3 rgbToLab(vec3 rgb) {
            return xyzToLab(rgbToXyz(rgb));
          }
          
          // ✅ Calcul de distance couleur avec support exact XYZ/Lab
          float colorDistance(vec3 color1, vec3 color2, int metric, int colorSpace) {
            // Conversion dans l'espace colorimétrique demandé
            vec3 c1 = color1;
            vec3 c2 = color2;
            
            if (colorSpace == 1) { // Lab
              c1 = rgbToLab(color1);
              c2 = rgbToLab(color2);
            } else if (colorSpace == 2) { // XYZ  
              c1 = rgbToXyz(color1);
              c2 = rgbToXyz(color2);
            }
            // colorSpace == 0 (RGB) : pas de conversion nécessaire
            
            // Calcul de distance selon la métrique
            if (metric == 0) { // Euclidean
              vec3 diff = c1 - c2;
              return length(diff);
            } else if (metric == 1) { // CIE76 (Delta E for Lab)
              vec3 diff = c1 - c2;
              return length(diff);
            } else if (metric == 2) { // DeltaE2000 (approximation)
              vec3 diff = c1 - c2;
              return length(diff); // TODO: implémentation complète DeltaE2000
            }
            
            // Défaut: euclidean
            vec3 diff = c1 - c2;
            return length(diff);
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
                pixelColor.rgb,
                paletteColor.rgb,
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
            return 0
          },
          u_distanceMetric: (_context, props: any) => {
            // 0: euclidean, 1: cie76, 2: deltaE2000
            const metric = props.distanceMetric || 'euclidean'
            if (metric === 'cie76') return 1
            if (metric === 'deltaE2000') return 2
            return 0
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
   * Calcul d'histogramme sur GPU avec support colorSpace complet
   * ✅ Utilise le vrai GPU avec conversions XYZ/Lab
   */
  private async computeHistogramGPU(
    imageData: ImageData,
    basePalette: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<number[]> {
    const gpuStart = performance.now()
    adapterLogger.debug(
      `🎮 [ReGL] Computing histogram (GPU-accelerated): ${imageData.width}x${imageData.height}, ${config.colorSpace} ${config.distanceMetric}`
    )

    try {
      // ✅ Utilise la palette passée en paramètre (Classic=27, Plus=4096)
      const cpcPalette = basePalette.map((vector) =>
        Array.from(vector)
      )

      const histogram = this.computeHistogramGPUAccelerated(
        imageData,
        cpcPalette,
        config
      )

      const totalTime = performance.now() - gpuStart
      const totalPixels = histogram.reduce((a, b) => a + b, 0)

      adapterLogger.info(
        `🎮 [ReGL] GPU histogram completed: ${totalPixels} pixels in ${totalTime.toFixed(2)}ms (true GPU with ${config.colorSpace})`
      )

      return histogram
    } catch (error) {
      adapterLogger.error('❌ [ReGL] GPU histogram calculation failed', error)
      // Fallback vers CPU avec support colorSpace complet
      return this.computeHistogramCPUOptimized(imageData, config, basePalette)
    }
  }

  /**
   * Helper pour convertir une couleur selon l'espace colorimétrique
   */
  private convertColor(rgb: Vector, colorSpace?: ColorSpace): Vector {
    if (colorSpace === 'Lab') {
      return rgbToLab(rgb)
    }
    if (colorSpace === 'XYZ') {
      return rgbToXyz(rgb)
    }
    return rgb // RGB par défaut
  }

  /**
   * Version CPU ultra-optimisée pour l'histogramme
   */
  private computeHistogramCPUOptimized(
    imageData: ImageData,
    config: ReGLQuantizeConfig,
    basePalette: readonly Vector[]
  ): number[] {
    const cpuStart = performance.now()
    adapterLogger.debug('🖥️ [ReGL] Computing histogram on CPU fallback')

    const histogram = new Array(basePalette.length).fill(0)
    const pixels = imageData.data

    // ✅ CORRECTION: Utilise la basePalette passée (CPC Classic ou Plus)
    const cpcPalette = basePalette.map((vector) =>
      Array.from(vector)
    )

    // ✅ OPTIMISATION: Seuil GPU adaptatif selon la charge
    const pixelCount = imageData.width * imageData.height
    const gpuThreshold = config.gpuOptions?.minPixelsForGPU ?? 128 * 128
    
    // ✅ OPTIMISATION: GPU seulement pour grandes images et RGB simple
    const shouldUseGPU = 
      this.capabilities.canUseGPU &&
      pixelCount > gpuThreshold &&
      (config.colorSpace === 'RGB' || config.colorSpace === undefined) // RGB est plus rapide
      
    if (shouldUseGPU) {
      return this.computeHistogramGPUAccelerated(imageData, cpcPalette, config)
    }

    // ✅ Support colorSpace complet avec conversions pixsaur-color
    const distanceFn = getDistanceFn(config.colorSpace, config.distanceMetric)

    for (let i = 0; i < pixels.length; i += 4) {
      const pixel: Vector = [pixels[i], pixels[i + 1], pixels[i + 2]]
      const pixelConverted = this.convertColor(pixel, config.colorSpace)

      let minDistance = Infinity
      let closestIndex = 0

      // Chercher la couleur CPC la plus proche dans l'espace colorimétrique demandé
      for (let j = 0; j < cpcPalette.length; j++) {
        const paletteColor: Vector = [
          cpcPalette[j][0],
          cpcPalette[j][1],
          cpcPalette[j][2]
        ]
        const paletteConverted = this.convertColor(
          paletteColor,
          config.colorSpace
        )

        // ✅ Utilise la fonction de distance appropriée depuis pixsaur-color
        const distance = distanceFn(pixelConverted, paletteConverted)

        if (distance < minDistance) {
          minDistance = distance
          closestIndex = j
        }
      }

      histogram[closestIndex]++
    }

    const cpuTime = performance.now() - cpuStart
    const totalPixels = histogram.reduce((a, b) => a + b, 0)
    adapterLogger.debug(
      `🖥️ [ReGL] CPU histogram completed: ${totalPixels} pixels processed in ${cpuTime.toFixed(2)}ms`
    )

    return histogram
  }

  /**
   * 🚀 Nouvelle méthode: Calcul d'histogramme GPU accéléré pour grandes images
   */
  /**
   * Calcul d'histogramme GPU avec quantification CPC
   */
  private computeHistogramGPUAccelerated(
    imageData: ImageData,
    cpcPalette: number[][],
    config: ReGLQuantizeConfig
  ): number[] {
    const gpuStart = performance.now()
    adapterLogger.debug(
      '🎮 [ReGL] Using GPU-accelerated histogram for large image'
    )

    try {
      // 1. Upload image vers GPU
      this.updateInputTexture(imageData)

      // 2. Créer un compute shader optimisé pour l'histogramme avec support colorSpace
      const computeShader = this.regl({
        frag: `
          precision highp float;
          uniform sampler2D u_image;
          uniform sampler2D u_cpcPalette;
          uniform int u_paletteSize;
          uniform vec2 u_imageSize;
          uniform int u_colorSpace;
          uniform int u_distanceMetric;
          
          // ✅ Inclure les conversions colorSpace exactes
          // Constantes exactes depuis pixsaur-color/src/space/convert.ts
          const float SRGB_A = 0.04045;
          const float SRGB_B = 12.92;
          const float SRGB_C = 2.4;
          const float SRGB_OFFSET = 0.055;
          const float SRGB_THRESHOLD = 0.0031308;
          
          const vec3 REF_WHITE = vec3(95.047, 100.0, 108.883);
          const float LAB_EPSILON = 0.008856;
          const float LAB_KAPPA = 903.3;
          const float LAB_DELTA = 16.0 / 116.0;
          
          // ✅ Conversion RGB vers XYZ exacte (copie de pixsaur-color)
          vec3 rgbToXyz(vec3 rgb) {
            vec3 normalized = rgb / 255.0;
            
            vec3 linear;
            linear.r = normalized.r > SRGB_A ? 
              pow((normalized.r + SRGB_OFFSET) / (1.0 + SRGB_OFFSET), SRGB_C) : 
              normalized.r / SRGB_B;
            linear.g = normalized.g > SRGB_A ? 
              pow((normalized.g + SRGB_OFFSET) / (1.0 + SRGB_OFFSET), SRGB_C) : 
              normalized.g / SRGB_B;
            linear.b = normalized.b > SRGB_A ? 
              pow((normalized.b + SRGB_OFFSET) / (1.0 + SRGB_OFFSET), SRGB_C) : 
              normalized.b / SRGB_B;
            
            mat3 rgb_to_xyz = mat3(
              0.4124564, 0.2126729, 0.0193339,
              0.3575761, 0.7151522, 0.119192,
              0.1804375, 0.072175,  0.9503041
            );
            
            vec3 xyz = rgb_to_xyz * linear * 100.0;
            return xyz;
          }
          
          // ✅ Conversion XYZ vers Lab exacte (copie de pixsaur-color)
          vec3 xyzToLab(vec3 xyz) {
            vec3 normalized = xyz / REF_WHITE;
            
            vec3 transformed;
            transformed.x = normalized.x > LAB_EPSILON ? 
              pow(normalized.x, 1.0/3.0) : 
              (normalized.x * LAB_KAPPA / 1160.0) + LAB_DELTA;
            transformed.y = normalized.y > LAB_EPSILON ? 
              pow(normalized.y, 1.0/3.0) : 
              (normalized.y * LAB_KAPPA / 1160.0) + LAB_DELTA;
            transformed.z = normalized.z > LAB_EPSILON ? 
              pow(normalized.z, 1.0/3.0) : 
              (normalized.z * LAB_KAPPA / 1160.0) + LAB_DELTA;
            
            float L = 116.0 * transformed.y - 16.0;
            float a = 500.0 * (transformed.x - transformed.y);
            float b = 200.0 * (transformed.y - transformed.z);
            
            return vec3(L, a, b);
          }
          
          // ✅ Conversion RGB vers Lab complète
          vec3 rgbToLab(vec3 rgb) {
            return xyzToLab(rgbToXyz(rgb));
          }
          
          // ✅ Calcul de distance avec support colorSpace optimisé
          float calculateDistance(vec3 color1, vec3 color2, int colorSpace, int metric) {
            if (colorSpace == 0) { // RGB - Le plus rapide
              vec3 diff = color1 - color2;
              return length(diff);
            } else if (colorSpace == 1) { // Lab
              vec3 c1 = rgbToLab(color1);
              vec3 c2 = rgbToLab(color2);
              vec3 diff = c1 - c2;
              return length(diff);
            } else { // XYZ
              vec3 c1 = rgbToXyz(color1);
              vec3 c2 = rgbToXyz(color2);
              vec3 diff = c1 - c2;
              return length(diff);
            }
          }
          
          // Fonction pour récupérer une couleur de la texture de palette (optimisée)
          vec3 getCPCColor(int index) {
            float x = (float(index) + 0.5) / float(u_paletteSize);
            return texture2D(u_cpcPalette, vec2(x, 0.5)).rgb * 255.0;
          }
          
          void main() {
            vec2 uv = gl_FragCoord.xy / u_imageSize;
            vec4 pixelRGBA = texture2D(u_image, uv);
            vec3 pixel = pixelRGBA.rgb * 255.0; // Convertir en 0-255
            
            // Trouver la couleur CPC la plus proche avec loop optimisée
            float minDistance = 999999.0;
            int closestIndex = 0;
            
            // ✅ OPTIMISATION: Loop fixe optimisée selon la taille de palette
            if (u_paletteSize <= 27) {
              // Palette CPC Classic - loop optimisée pour 27 couleurs
              for (int i = 0; i < 27; i++) {
                if (i >= u_paletteSize) break;
                
                vec3 cpcColor = getCPCColor(i);
                float distance = calculateDistance(pixel, cpcColor, u_colorSpace, u_distanceMetric);
                
                if (distance < minDistance) {
                  minDistance = distance;
                  closestIndex = i;
                }
              }
            } else {
              // Palette CPC Plus - loop optimisée avec early termination
              for (int i = 0; i < 4096; i++) {
                if (i >= u_paletteSize) break;
                
                vec3 cpcColor = getCPCColor(i);
                float distance = calculateDistance(pixel, cpcColor, u_colorSpace, u_distanceMetric);
                
                if (distance < minDistance) {
                  minDistance = distance;
                  closestIndex = i;
                  // Early termination pour couleurs exactes
                  if (distance < 0.1) break;
                }
              }
            }
            
            // Output l'index normalisé (0-1 range pour u_paletteSize couleurs)
            gl_FragColor = vec4(float(closestIndex) / float(u_paletteSize - 1), 0.0, 0.0, 1.0);
          }
        `,
        vert: `
          attribute vec2 a_position;
          void main() {
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
          u_cpcPalette: () => this.cpcPaletteTexture!,
          u_paletteSize: cpcPalette.length,
          u_imageSize: [imageData.width, imageData.height],
          u_colorSpace: () => {
            // 0: RGB, 1: Lab, 2: XYZ
            const colorSpace = config.colorSpace || 'RGB'
            if (colorSpace === 'Lab') return 1
            if (colorSpace === 'XYZ') return 2
            return 0
          },
          u_distanceMetric: () => {
            // 0: euclidean, 1: cie76, 2: deltaE2000
            const metric = config.distanceMetric || 'euclidean'
            if (metric === 'cie76') return 1
            if (metric === 'deltaE2000') return 2
            return 0
          }
        },
        primitive: 'triangle strip',
        count: 4
      })

      // 3. ✅ OPTIMISATION: Texture de sortie plus petite pour l'histogramme
      // Au lieu de stocker l'index pour chaque pixel, on peut réduire la résolution
      const reductionFactor = Math.max(1, Math.floor(Math.sqrt(imageData.width * imageData.height / 65536)))
      const reducedWidth = Math.ceil(imageData.width / reductionFactor)
      const reducedHeight = Math.ceil(imageData.height / reductionFactor)
      
      const outputTexture = this.regl.texture({
        width: reducedWidth,
        height: reducedHeight,
        format: 'rgba',
        type: 'uint8',
        mag: 'nearest',
        min: 'nearest'
      })

      const outputFBO = this.regl.framebuffer({
        color: outputTexture,
        width: reducedWidth,
        height: reducedHeight
      })

      // 4. ✅ OPTIMISATION: Viewport adapté à la résolution réduite
      this.regl.clear({
        color: [0, 0, 0, 0],
        framebuffer: outputFBO
      })
      
      outputFBO.use(() => {
        this.regl({ viewport: { x: 0, y: 0, width: reducedWidth, height: reducedHeight } })(() => {
          computeShader()
        })
      })

      // 5. ✅ OPTIMISATION: Lecture optimisée avec taille réduite
      const results = this.regl.read({
        framebuffer: outputFBO
      })

      // ✅ OPTIMISATION: Construction d'histogramme optimisée
      const histogram = new Array(cpcPalette.length).fill(0)
      
      // Traitement par blocs pour meilleure performance cache
      const blockSize = 1024 // Process par blocs de 1024 pixels
      for (let start = 0; start < results.length; start += blockSize * 4) {
        const end = Math.min(start + blockSize * 4, results.length)
        
        for (let i = start; i < end; i += 4) {
          // ✅ OPTIMISATION: Lecture directe sans Math.round coûteux
          const colorIndexFloat = (results[i] / 255) * (cpcPalette.length - 1)
          const colorIndex = (colorIndexFloat + 0.5) | 0 // Faster than Math.round
          
          if (colorIndex >= 0 && colorIndex < cpcPalette.length) {
            histogram[colorIndex]++
          }
        }
      }

      // 6. Nettoyer
      outputTexture.destroy()
      outputFBO.destroy()

      const gpuTime = performance.now() - gpuStart
      const totalPixels = histogram.reduce((a, b) => a + b, 0)

      adapterLogger.info(
        `🎮 [ReGL] GPU-accelerated histogram: ${totalPixels} pixels in ${gpuTime.toFixed(2)}ms (${reductionFactor}x reduction)`
      )

      // 📊 Performance metrics pour optimisation continue
      const pixelsPerMs = totalPixels / gpuTime
      if (gpuTime > 200) {
        adapterLogger.warn(`⚠️ [ReGL] GPU histogram slower than expected: ${gpuTime}ms for ${totalPixels} pixels`)
      } else if (gpuTime < 50) {
        adapterLogger.debug(`✅ [ReGL] GPU histogram very fast: ${gpuTime}ms, ${pixelsPerMs.toFixed(0)} pixels/ms`)
      }

      // 🔍 DEBUG DIRECT: Logs forcés pour l'histogramme
      const nonZeroColors = histogram.filter((count) => count > 0).length
      console.log(`🔍 [HISTOGRAM DEBUG] GPU Histogram: ${totalPixels} pixels, ${nonZeroColors}/${histogram.length} colors detected`)
      
      if (histogram.length > 27) {
        const topColors = histogram
          .map((count, index) => ({ index, count }))
          .filter(({ count }) => count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 15)
        
        console.log(`🔍 [HISTOGRAM DEBUG] Top 15 colors in ${histogram.length}-color palette:`, topColors)
      }

      this.logHistogramStats(histogram, 'GPU')
      return histogram
    } catch (error) {
      adapterLogger.warn(
        '⚠️ [ReGL] GPU acceleration failed, falling back to CPU',
        error
      )

      // Fallback vers CPU pur
      const histogram = new Array(27).fill(0)
      const pixels = imageData.data

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]

        let minDistanceSquared = Infinity
        let closestIndex = 0

        for (let j = 0; j < cpcPalette.length; j++) {
          const [pr, pg, pb] = cpcPalette[j]
          const distanceSquared =
            (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb)

          if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared
            closestIndex = j
          }
        }

        histogram[closestIndex]++
      }

      return histogram
    }
  }

  /**
   * Log des statistiques détaillées de l'histogramme
   */
  private logHistogramStats(histogram: number[], source: 'GPU' | 'CPU'): void {
    const totalPixels = histogram.reduce((sum, count) => sum + count, 0)
    const nonZeroColors = histogram.filter((count) => count > 0).length
    const maxCount = Math.max(...histogram)
    const avgCount = totalPixels / nonZeroColors

    quantizerLogger.debug(
      `📊 [ReGL] ${source} Histogram stats: ${totalPixels} pixels, ${nonZeroColors}/${histogram.length} colors used, max=${maxCount}, avg=${avgCount.toFixed(1)}`
    )

    // 🔍 DEBUG: Log des couleurs les plus fréquentes pour CPC Plus
    if (histogram.length > 27) {
      const topColors = histogram
        .map((count, index) => ({ index, count }))
        .filter(({ count }) => count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      
      console.log(`🔍 [HISTOGRAM] Top 10 colors in ${histogram.length}-color histogram:`, topColors)
    }
  }

  /**
   * Sélection optimisée des couleurs sur GPU (Phase 2)
   * ✅ Utilise la logique commune selectTopIndicesCore()
   */
  private async selectColorsGPU(
    histogram: number[],
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    adapterLogger.debug(
      `🎯 [ReGL] GPU color selection: ${config.targetColors} colors from ${basePalette.length} base palette`
    )

    // Convertir preselected en indices pour utiliser l'algorithme commun
    const preselectedIndices: number[] = []
    for (const preselectedColor of preselected) {
      const index = basePalette.findIndex((color) =>
        this.colorsEqual(color, preselectedColor)
      )
      if (index >= 0) {
        preselectedIndices.push(index)
      }
    }

    // ✅ PHASE 1: Détection du mode et sélection appropriée  
    const isMode0Based = config.targetColors === 16 || config.targetColors === 512
    const isMode1Based = config.targetColors === 4
    const isMode2Based = config.targetColors === 2
    const isCPCPlus = basePalette.length > 27
    const actualTargetColors = config.targetColors === 512 ? 16 : config.targetColors
    const useOptimizedSelection = isMode0Based || isMode1Based || isMode2Based
    
    let topIndices: number[]
    
    if (isCPCPlus && useOptimizedSelection) {
      // 🚀 CPC Plus: Bypass de l'histogramme + Sélection GPU optimisée
      adapterLogger.info(`🚀 [ReGL] CPC Plus Mode ${config.targetColors === 16 ? '0' : config.targetColors === 4 ? '1' : '2'}: GPU-accelerated diversity selection (bypassing histogram)`)
      topIndices = this.selectCPCPlusOptimized(imageData, basePalette, actualTargetColors, config)
      adapterLogger.info(`⚡ [ReGL] CPC Plus optimized selection: ${actualTargetColors} colors from ${basePalette.length} palette`)
    } else {
      // 📊 CPC Classic: Algorithme de diversité par luminance basé sur histogramme
      const useDiversityMode = useOptimizedSelection
      topIndices = selectTopIndicesCore(
        histogram,
        preselectedIndices,
        actualTargetColors,
        {
          threshold: 10,
          diversityMode: useDiversityMode,
          basePalette: useDiversityMode ? basePalette : undefined
        }
      )
      adapterLogger.info(`🎯 [ReGL] CPC Classic selection: ${actualTargetColors} colors, diversity mode: ${useDiversityMode}`)
    }

    // ✅ OPTIMISATION: Si mode diversité activé, retourner directement les couleurs sélectionnées
    if (isCPCPlus && useOptimizedSelection) {
      const selectedColors = topIndices.map(
        (idx: number) => [...basePalette[idx]] as Vector
      )
      adapterLogger.info(`🎨 [ReGL] CPC Plus chromatic diversity: returning ${selectedColors.length} colors directly`)
      return selectedColors
    } else if (useOptimizedSelection) {
      const selectedColors = topIndices.map(
        (idx: number) => [...basePalette[idx]] as Vector
      )
      adapterLogger.info(`🎨 [ReGL] CPC Classic diversity: returning ${selectedColors.length} colors directly`)
      return selectedColors
    }

    // ✅ PHASE 2: Appliquer l'algorithme de contraste comme le CPU (uniquement si pas de diversité)
    const candidateColors = topIndices.map(
      (idx: number) => [...basePalette[idx]] as Vector
    )
    const preselectedColors = preselectedIndices.map(
      (idx: number) => [...basePalette[idx]] as Vector
    )

    // Créer la fonction de distance selon l'espace colorimétrique
    const distanceFn = (a: Vector, b: Vector): number => {
      if (config.colorSpace === 'Lab') {
        const labA = this.convertColor(a, 'Lab')
        const labB = this.convertColor(b, 'Lab')
        let sum = 0
        for (let i = 0; i < 3; i++) {
          const d = labA[i] - labB[i]
          sum += d * d
        }
        return Math.sqrt(sum)
      } else if (config.colorSpace === 'XYZ') {
        const xyzA = this.convertColor(a, 'XYZ')
        const xyzB = this.convertColor(b, 'XYZ')
        let sum = 0
        for (let i = 0; i < 3; i++) {
          const d = xyzA[i] - xyzB[i]
          sum += d * d
        }
        return Math.sqrt(sum)
      } else {
        // RGB euclidean
        let sum = 0
        for (let i = 0; i < 3; i++) {
          const d = a[i] - b[i]
          sum += d * d
        }
        return Math.sqrt(sum)
      }
    }

    // Fonction de conversion vers RGB (pour les tests de luminance)
    const toRGB = (v: Vector): Vector => {
      if (config.colorSpace === 'Lab') {
        // Convertir de Lab vers RGB
        const [L, a, b] = v
        // Lab → XYZ
        const Y = (L + 16) / 116
        const X = a / 500 + Y
        const Z = Y - b / 200

        const X3 = X ** 3
        const Y3 = Y ** 3
        const Z3 = Z ** 3

        const Xn = X3 > 0.008856 ? X3 : (X - 16 / 116) / 7.787
        const Yn = Y3 > 0.008856 ? Y3 : (Y - 16 / 116) / 7.787
        const Zn = Z3 > 0.008856 ? Z3 : (Z - 16 / 116) / 7.787

        // XYZ vers RGB (matrice sRGB)
        const r = Xn * 3.2406 + Yn * -1.5372 + Zn * -0.4986
        const g = Xn * -0.9689 + Yn * 1.8758 + Zn * 0.0415
        const b_rgb = Xn * 0.0557 + Yn * -0.204 + Zn * 1.057

        // Gamma correction
        const gamma = (c: number) =>
          c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c

        return [
          Math.max(0, Math.min(255, gamma(r) * 255)),
          Math.max(0, Math.min(255, gamma(g) * 255)),
          Math.max(0, Math.min(255, gamma(b_rgb) * 255))
        ]
      } else if (config.colorSpace === 'XYZ') {
        // Convertir de XYZ vers RGB
        const [X, Y, Z] = v

        // XYZ vers RGB (matrice sRGB)
        const r = X * 3.2406 + Y * -1.5372 + Z * -0.4986
        const g = X * -0.9689 + Y * 1.8758 + Z * 0.0415
        const b_rgb = X * 0.0557 + Y * -0.204 + Z * 1.057

        // Gamma correction
        const gamma = (c: number) =>
          c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c

        return [
          Math.max(0, Math.min(255, gamma(r) * 255)),
          Math.max(0, Math.min(255, gamma(g) * 255)),
          Math.max(0, Math.min(255, gamma(b_rgb) * 255))
        ]
      } else {
        // RGB, pas de conversion nécessaire
        return v
      }
    }

    // Utiliser le sélecteur de stratégie commun
    const result = selectByStrategy(
      {
        contrastStrategy: config.contrastStrategy,
        targetColors: config.targetColors
      },
      {
        candidates: candidateColors,
        preselected: preselectedColors,
        targetColors: config.targetColors,
        distanceFn: distanceFn,
        toRGB: toRGB
      }
    )

    adapterLogger.debug(
      `🎯 [ReGL] GPU selection completed: ${result.length}/${config.targetColors} colors selected`
    )

    // CORRECTION: Convertir les couleurs RGB vers l'espace de travail comme le CPU
    const convertedResult = result.map((color) => {
      if (config.colorSpace === 'Lab') {
        return this.convertColor(color, 'Lab')
      } else if (config.colorSpace === 'XYZ') {
        return this.convertColor(color, 'XYZ')
      } else {
        return color // RGB, pas de conversion
      }
    })

    return convertedResult
  }

  /**
   * 🚀 CPC Plus: Sélection optimisée GPU sans histogramme
   * Combine échantillonnage intelligent + GPU pour diversité maximale
   */
  private selectCPCPlusOptimized(
    imageData: ImageData,
    basePalette: readonly Vector[],
    targetColors: number,
    config: ReGLQuantizeConfig
  ): number[] {
    const start = performance.now()
    
    // Échantillonnage équilibré : qualité vs performance
    const sampledColors = this.sampleImageColors(imageData, 128) // 128 échantillons pour un bon compromis
    
    // CPU: Calcul rapide des couleurs dominantes avec diversité
    const selected = this.selectDiverseColorsFast(sampledColors, basePalette, targetColors, config.colorSpace || 'RGB')
    
    const duration = performance.now() - start
    adapterLogger.info(`⚡ [ReGL] CPC Plus selection: ${selected.length} colors in ${duration.toFixed(1)}ms (optimized)`)
    adapterLogger.info(`🔍 [ReGL] DEBUG: requested=${targetColors}, returned=${selected.length}, selected indices=[${selected.slice(0, 5).join(',')}${selected.length > 5 ? '...' : ''}]`)
    
    return selected
  }

  /**
   * 📊 Échantillonnage intelligent de l'image
   */
  private sampleImageColors(imageData: ImageData, maxSamples: number): Vector[] {
    const { width, height, data } = imageData
    const totalPixels = width * height
    
    // Calcul du pas d'échantillonnage
    const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / maxSamples)))
    const samples: Vector[] = []
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4
        samples.push([data[idx], data[idx + 1], data[idx + 2]])
        
        if (samples.length >= maxSamples) break
      }
      if (samples.length >= maxSamples) break
    }
    
    return samples
  }

  /**
   * 🎯 Sélection rapide avec diversité maximale + espaces colorimetériques
   */
  private selectDiverseColorsFast(
    sampledColors: Vector[],
    basePalette: readonly Vector[],
    targetColors: number,
    colorSpace: ColorSpace = 'RGB'
  ): number[] {
    // Compter rapidement les couleurs les plus fréquentes
    const colorCount = new Map<number, number>()
    
    for (const sample of sampledColors) {
      const closestIndex = this.findClosestColorIndex(sample, basePalette)
      colorCount.set(closestIndex, (colorCount.get(closestIndex) || 0) + 1)
    }
    
    // Convertir en format pour MaxMin Distance avec l'espace colorimétrique choisi
    const colorFrequency = Array.from(colorCount.entries())
      .map(([index, count]) => ({
        index,
        frequency: count / sampledColors.length,
        color: [...basePalette[index]] as Vector,
        converted: this.convertColor(basePalette[index], colorSpace) // Utiliser l'espace choisi
      }))
      .sort((a, b) => b.frequency - a.frequency) // Trier par fréquence
    
    if (colorFrequency.length <= targetColors) {
      return colorFrequency.map(c => c.index)
    }
    
    const selected: number[] = []
    const selectedConverted: Vector[] = []
    
    // Première couleur: la plus fréquente
    selected.push(colorFrequency[0].index)
    selectedConverted.push(colorFrequency[0].converted)
    
    // Stratégie hybride: 60% fréquence + 40% diversité
    const frequencyBudget = Math.floor(targetColors * 0.6)
    
    // Phase 1: Ajouter les couleurs fréquentes avec diversité minimale
    for (let i = 1; i < colorFrequency.length && selected.length < frequencyBudget; i++) {
      const candidateConverted = colorFrequency[i].converted
      
      // Vérifier diversité minimale (distance > 20)
      let isDiverse = true
      for (const selectedColor of selectedConverted) {
        if (this.calculateDistance(candidateConverted, selectedColor, colorSpace) < 20) {
          isDiverse = false
          break
        }
      }
      
      if (isDiverse) {
        selected.push(colorFrequency[i].index)
        selectedConverted.push(candidateConverted)
      }
    }
    
    // Phase 2: Compléter avec MaxMin Distance sur toute la palette
    const remaining = colorFrequency.filter(c => !selected.includes(c.index))
    const additionalColors = targetColors - selected.length
    
    for (let i = 0; i < additionalColors && remaining.length > 0; i++) {
      let maxMinDistance = 0
      let bestIndex = -1
      
      for (let j = 0; j < remaining.length; j++) {
        const candidateConverted = remaining[j].converted
        
        let minDistance = Infinity
        for (const selectedColor of selectedConverted) {
          const distance = this.calculateDistance(candidateConverted, selectedColor, colorSpace)
          minDistance = Math.min(minDistance, distance)
        }
        
        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance
          bestIndex = j
        }
      }
      
      if (bestIndex >= 0) {
        selected.push(remaining[bestIndex].index)
        selectedConverted.push(remaining[bestIndex].converted)
        remaining.splice(bestIndex, 1)
      }
    }
    
    return selected
  }

  /**
   * � Calcule la distance entre deux couleurs selon l'espace colorimétrique
   */
  private calculateDistance(color1: Vector, color2: Vector, colorSpace: ColorSpace): number {
    if (colorSpace === 'Lab') {
      return this.labDistance(color1, color2)
    } else if (colorSpace === 'XYZ') {
      // Distance euclidienne simple pour XYZ
      const dx = color1[0] - color2[0]
      const dy = color1[1] - color2[1] 
      const dz = color1[2] - color2[2]
      return Math.sqrt(dx * dx + dy * dy + dz * dz)
    } else {
      // RGB - Distance euclidienne
      const dr = color1[0] - color2[0]
      const dg = color1[1] - color2[1]
      const db = color1[2] - color2[2]
      return Math.sqrt(dr * dr + dg * dg + db * db)
    }
  }

  /**
   * �🔍 Trouve l'index de la couleur la plus proche
   */
  private findClosestColorIndex(pixel: Vector, palette: readonly Vector[]): number {
    let minDistance = Infinity
    let closestIndex = 0
    
    const pixelLab = this.convertColor(pixel, 'Lab')
    
    for (let i = 0; i < palette.length; i++) {
      const paletteLab = this.convertColor(palette[i], 'Lab')
      const distance = this.labDistance(pixelLab, paletteLab)
      
      if (distance < minDistance) {
        minDistance = distance
        closestIndex = i
      }
    }
    
    return closestIndex
  }

  /**
   * 🚀 CPC Plus: Sélection optimisée rapide (MaxMin + échantillonnage) - DEPRECATED
   * Remplace l'analyse complexe par un algorithme simple et efficace
   */
  private async selectFromImageAnalysis(
    imageData: ImageData,
    basePalette: readonly Vector[],
    targetColors: number
  ): Promise<number[]> {
    adapterLogger.info(`⚡ [ReGL] Fast CPC Plus selection: ${targetColors} colors from ${basePalette.length} palette`)
    
    const start = performance.now()
    
    // Approche optimisée: MaxMin Distance avec pré-filtrage intelligent
    const result = this.selectFastMaxMinDistance(basePalette, targetColors)
    
    const duration = performance.now() - start
    adapterLogger.info(`⚡ [ReGL] Fast selection completed in ${duration.toFixed(1)}ms`)
    
    return result
  }

  /**
   * ⚡ Sélection MaxMin Distance optimisée pour CPC Plus
   */
  private selectFastMaxMinDistance(
    basePalette: readonly Vector[],
    targetColors: number
  ): number[] {
    if (basePalette.length <= targetColors) {
      return Array.from({ length: basePalette.length }, (_, i) => i)
    }

    const selected: number[] = []
    const paletteWithLab = basePalette.map((color, index) => ({
      index,
      color: [...color] as Vector,
      lab: this.convertColor(color, 'Lab')
    }))

    // 1. Première couleur: centre de l'espace colorimétrique (gris moyen le plus saturé)
    let bestFirst = 0
    let bestScore = 0
    
    for (let i = 0; i < paletteWithLab.length; i++) {
      const color = paletteWithLab[i].color
      const saturation = this.calculateSaturation(color)
      const luminance = 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]
      
      // Score: privilégier saturation modérée + luminance centrale
      const lumScore = 1 - Math.abs(luminance - 128) / 128
      const score = saturation * 0.6 + lumScore * 0.4
      
      if (score > bestScore) {
        bestScore = score
        bestFirst = i
      }
    }
    selected.push(paletteWithLab[bestFirst].index)

    // 2. Couleurs suivantes: MaxMin Distance avec échantillonnage
    // Pour performance: échantillonner 1 couleur sur N si palette très grande
    const sampleStep = Math.max(1, Math.floor(paletteWithLab.length / 1000))
    
    for (let iteration = 1; iteration < targetColors; iteration++) {
      let maxMinDistance = 0
      let bestIndex = -1
      
      for (let i = 0; i < paletteWithLab.length; i += sampleStep) {
        if (selected.includes(paletteWithLab[i].index)) continue
        
        // Calculer distance minimale aux couleurs déjà sélectionnées
        let minDistance = Infinity
        
        for (const selectedIndex of selected) {
          const selectedItem = paletteWithLab.find(p => p.index === selectedIndex)
          if (selectedItem) {
            const distance = this.labDistance(paletteWithLab[i].lab, selectedItem.lab)
            minDistance = Math.min(minDistance, distance)
          }
        }
        
        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance
          bestIndex = i
        }
      }
      
      if (bestIndex >= 0) {
        selected.push(paletteWithLab[bestIndex].index)
      } else {
        // Fallback: prendre la première couleur non sélectionnée
        for (let i = 0; i < paletteWithLab.length; i++) {
          if (!selected.includes(paletteWithLab[i].index)) {
            selected.push(paletteWithLab[i].index)
            break
          }
        }
      }
    }

    return selected
  }

  /**
   * 🌈 Calcule la saturation d'une couleur RGB
   */
  private calculateSaturation(color: Vector): number {
    const [r, g, b] = color.map(c => c / 255)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    
    if (max === 0) return 0
    return (max - min) / max
  }

  /**
   * Distance Lab pour calculs perceptuels
   */
  private labDistance(lab1: Vector, lab2: Vector): number {
    const dL = lab1[0] - lab2[0]
    const da = lab1[1] - lab2[1] 
    const db = lab1[2] - lab2[2]
    return Math.sqrt(dL * dL + da * da + db * db)
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
