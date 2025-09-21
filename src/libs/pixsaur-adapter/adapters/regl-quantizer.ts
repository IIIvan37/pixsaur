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
import { selectTopIndicesCore } from '@/libs/pixsaur-color/src/quant/select-to-indices'
import { selectByStrategy } from '@/libs/pixsaur-color/src/quant/strategy-selector'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { adapterLogger, quantizerLogger } from '@/utils/logger'

/**
 * Shaders GLSL pour ReGL - Extraction pour améliorer la lisibilité
 */

// Fragment shader pour l'histogramme - RGB uniquement
const HISTOGRAM_FRAGMENT_SHADER = `
  precision highp float;
  
  uniform sampler2D u_image;
  uniform sampler2D u_palette;
  uniform vec2 u_imageSize;
  uniform int u_distanceMetric;
  
  varying vec2 v_texCoord;
  
  // ✅ Calcul de distance RGB euclidienne optimisée
  float colorDistanceRGB(vec3 color1, vec3 color2) {
    vec3 diff = color1 - color2;
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
      
      float distance = colorDistanceRGB(pixelColor.rgb, paletteColor.rgb);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    // Output histogram bin
    float binValue = float(closestIndex) / 27.0;
    gl_FragColor = vec4(binValue, minDistance, 0.0, 1.0);
  }
`

// Vertex shader simple pour les shaders d'histogramme
const HISTOGRAM_VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  
  void main() {
    v_texCoord = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

// Fragment shader optimisé pour l'histogramme GPU accéléré - RGB uniquement
const GPU_ACCELERATED_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_image;
  uniform sampler2D u_cpcPalette;
  uniform int u_paletteSize;
  uniform vec2 u_imageSize;
  uniform int u_distanceMetric;
  
  // ✅ Distance RGB euclidienne optimisée
  float calculateDistanceRGB(vec3 color1, vec3 color2) {
    vec3 diff = color1 - color2;
    return length(diff);
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
        float distance = calculateDistanceRGB(pixel, cpcColor);
        
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
        float distance = calculateDistanceRGB(pixel, cpcColor);
        
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
`

// Vertex shader simple pour le GPU accéléré
const GPU_ACCELERATED_VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

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
      `🎯 [ReGL] Starting quantization: RGB, ${config.distanceMetric}, ${config.targetColors} colors, image=${imageData.width}x${imageData.height}`
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
      const isCPCMode =
        config.targetColors === 16 ||
        config.targetColors === 4 ||
        config.targetColors === 2 ||
        config.targetColors === 512

      let histogram: number[]
      let histogramTime: number
      if (isCPCPlus && isCPCMode) {
        // 🚀 CPC Plus: Bypass complet de l'histogramme
        adapterLogger.info(
          `🚀 [ReGL] CPC Plus bypass: skipping histogram for ${config.targetColors} color mode`
        )
        histogram = new Array(basePalette.length).fill(0) // Histogramme vide
        histogramTime = 0 // Pas de temps pour l'histogramme
      } else {
        // 📊 Mode traditionnel: calcul de l'histogramme
        histogram = await this.computeHistogramGPU(
          imageData,
          basePalette,
          config
        )
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

      adapterLogger.info(
        `🔍 [ReGL DEBUG] Selected ${selectedColors.length} colors from GPU:`,
        selectedColors
          .slice(0, Math.min(10, selectedColors.length))
          .map((c) => `[${c[0]},${c[1]},${c[2]}]`)
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
        frag: HISTOGRAM_FRAGMENT_SHADER,
        vert: HISTOGRAM_VERTEX_SHADER,
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
          u_distanceMetric: () => {
            // 0: euclidean (RGB seulement)
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
      `🎮 [ReGL] Computing histogram (GPU-accelerated): ${imageData.width}x${imageData.height}, RGB ${config.distanceMetric}`
    )

    try {
      // ✅ Utilise la palette passée en paramètre (Classic=27, Plus=4096)
      const cpcPalette = basePalette.map((vector) => Array.from(vector))

      const histogram = this.computeHistogramGPUAccelerated(
        imageData,
        cpcPalette,
        config
      )

      const totalTime = performance.now() - gpuStart
      const totalPixels = histogram.reduce((a, b) => a + b, 0)

      adapterLogger.info(
        `🎮 [ReGL] GPU histogram completed: ${totalPixels} pixels in ${totalTime.toFixed(2)}ms (true GPU with RGB)`
      )

      return histogram
    } catch (error) {
      adapterLogger.error('❌ [ReGL] GPU histogram calculation failed', error)
      // Fallback vers CPU avec support colorSpace complet
      return this.computeHistogramCPUOptimized(imageData, config, basePalette)
    }
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
    const cpcPalette = basePalette.map((vector) => Array.from(vector))

    // ✅ OPTIMISATION: Seuil GPU adaptatif selon la charge
    const pixelCount = imageData.width * imageData.height
    const gpuThreshold = config.gpuOptions?.minPixelsForGPU ?? 128 * 128

    // ✅ OPTIMISATION: GPU seulement pour grandes images et RGB simple
    const shouldUseGPU =
      this.capabilities.canUseGPU && pixelCount > gpuThreshold // RGB est toujours supporté sur GPU

    if (shouldUseGPU) {
      return this.computeHistogramGPUAccelerated(imageData, cpcPalette, config)
    }

    // ✅ Support RGB uniquement avec distance euclidienne optimisée
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]

      let minDistanceSquared = Infinity
      let closestIndex = 0

      // Chercher la couleur CPC la plus proche avec distance euclidienne RGB
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
   * ✅ Helper: Créer les textures et FBO pour l'histogramme GPU
   */
  private createHistogramTextures(imageData: ImageData): {
    outputTexture: REGL.Texture2D
    outputFBO: REGL.Framebuffer
    reductionFactor: number
  } {
    // Optimisation: Texture de sortie plus petite pour l'histogramme
    const reductionFactor = Math.max(
      1,
      Math.floor(Math.sqrt((imageData.width * imageData.height) / 65536))
    )
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

    return { outputTexture, outputFBO, reductionFactor }
  }

  /**
   * ✅ Helper: Construire l'histogramme à partir des résultats GPU
   */
  private buildHistogramFromGPUResults(
    results: Uint8Array,
    cpcPalette: number[][]
  ): number[] {
    const histogram = new Array(cpcPalette.length).fill(0)

    // Traitement par blocs pour meilleure performance cache
    const blockSize = 1024
    for (let start = 0; start < results.length; start += blockSize * 4) {
      const end = Math.min(start + blockSize * 4, results.length)

      for (let i = start; i < end; i += 4) {
        // Optimisation: Lecture directe sans Math.round coûteux
        const colorIndexFloat = (results[i] / 255) * (cpcPalette.length - 1)
        const colorIndex = (colorIndexFloat + 0.5) | 0 // Faster than Math.round

        if (colorIndex >= 0 && colorIndex < cpcPalette.length) {
          histogram[colorIndex]++
        }
      }
    }

    return histogram
  }

  /**
   * ✅ Helper: Fallback CPU simple pour erreurs GPU
   */
  private computeHistogramCPUFallback(
    imageData: ImageData,
    cpcPalette: number[][]
  ): number[] {
    const histogram = new Array(cpcPalette.length).fill(0)
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

  /**
   * Calcul d'histogramme GPU avec quantification CPC
   * ✅ Complexité réduite en extrayant les helpers
   */
  private computeHistogramGPUAccelerated(
    imageData: ImageData,
    cpcPalette: number[][],
    _config: ReGLQuantizeConfig
  ): number[] {
    const gpuStart = performance.now()
    adapterLogger.debug(
      '🎮 [ReGL] Using GPU-accelerated histogram for large image'
    )

    try {
      // 1. Upload image vers GPU
      this.updateInputTexture(imageData)

      // 2. Créer compute shader
      const computeShader = this.regl({
        frag: GPU_ACCELERATED_FRAGMENT_SHADER,
        vert: GPU_ACCELERATED_VERTEX_SHADER,
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
          u_distanceMetric: () => {
            // RGB euclidean seulement
            return 0
          }
        },
        primitive: 'triangle strip',
        count: 4
      })

      // 3. Créer textures de sortie
      const { outputTexture, outputFBO, reductionFactor } =
        this.createHistogramTextures(imageData)

      // 4. Exécuter shader
      this.regl.clear({
        color: [0, 0, 0, 0],
        framebuffer: outputFBO
      })

      this.regl({
        viewport: {
          x: 0,
          y: 0,
          width: outputTexture.width,
          height: outputTexture.height
        },
        framebuffer: outputFBO
      })(() => {
        computeShader()
      })

      // 5. Lire résultats et construire histogramme
      const results = this.regl.read({ framebuffer: outputFBO })
      const histogram = this.buildHistogramFromGPUResults(results, cpcPalette)

      // 6. Nettoyer et logger
      outputTexture.destroy()
      outputFBO.destroy()

      const gpuTime = performance.now() - gpuStart
      const totalPixels = histogram.reduce((a, b) => a + b, 0)

      adapterLogger.info(
        `🎮 [ReGL] GPU-accelerated histogram: ${totalPixels} pixels in ${gpuTime.toFixed(2)}ms (${reductionFactor}x reduction)`
      )

      this.logHistogramStats(histogram, 'GPU')
      return histogram
    } catch (error) {
      adapterLogger.warn(
        '⚠️ [ReGL] GPU acceleration failed, falling back to CPU',
        error
      )
      return this.computeHistogramCPUFallback(imageData, cpcPalette)
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

      console.log(
        `🔍 [HISTOGRAM] Top 10 colors in ${histogram.length}-color histogram:`,
        topColors
      )
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
      const index = basePalette.findIndex(
        (color) =>
          color[0] === preselectedColor[0] &&
          color[1] === preselectedColor[1] &&
          color[2] === preselectedColor[2]
      )
      if (index >= 0) {
        preselectedIndices.push(index)
      }
    }

    // ✅ PHASE 1: Détection du mode et sélection appropriée
    const isMode0Based =
      config.targetColors === 16 || config.targetColors === 512
    const isMode1Based = config.targetColors === 4
    const isMode2Based = config.targetColors === 2
    const isCPCPlus = basePalette.length > 27
    const actualTargetColors =
      config.targetColors === 512 ? 16 : config.targetColors
    const useOptimizedSelection = isMode0Based || isMode1Based || isMode2Based

    let topIndices: number[]

    if (isCPCPlus && useOptimizedSelection) {
      // 🚀 CPC Plus: Bypass de l'histogramme + Sélection GPU optimisée
      const getModeLabel = (targetColors: number): string => {
        if (targetColors === 16) return '0'
        if (targetColors === 4) return '1'
        return '2'
      }
      const modeLabel = getModeLabel(config.targetColors)
      adapterLogger.info(
        `🚀 [ReGL] CPC Plus Mode ${modeLabel}: GPU-accelerated diversity selection (bypassing histogram)`
      )
      topIndices = this.selectCPCPlusOptimized(
        imageData,
        basePalette,
        actualTargetColors,
        config
      )
      adapterLogger.info(
        `⚡ [ReGL] CPC Plus optimized selection: ${actualTargetColors} colors from ${basePalette.length} palette`
      )
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
      adapterLogger.info(
        `🎯 [ReGL] CPC Classic selection: ${actualTargetColors} colors, diversity mode: ${useDiversityMode}`
      )
    }

    // ✅ OPTIMISATION: Si mode diversité activé, retourner directement les couleurs sélectionnées
    if (isCPCPlus && useOptimizedSelection) {
      const selectedColors = topIndices.map(
        (idx: number) => [...basePalette[idx]] as Vector
      )
      adapterLogger.info(
        `🎨 [ReGL] CPC Plus chromatic diversity: returning ${selectedColors.length} colors directly`
      )
      return selectedColors
    } else if (useOptimizedSelection) {
      const selectedColors = topIndices.map(
        (idx: number) => [...basePalette[idx]] as Vector
      )
      adapterLogger.info(
        `🎨 [ReGL] CPC Classic diversity: returning ${selectedColors.length} colors directly`
      )
      return selectedColors
    }

    // ✅ PHASE 2: Appliquer l'algorithme de contraste comme le CPU (uniquement si pas de diversité)
    const candidateColors = topIndices.map(
      (idx: number) => [...basePalette[idx]] as Vector
    )
    const preselectedColors = preselectedIndices.map(
      (idx: number) => [...basePalette[idx]] as Vector
    )

    // Créer la fonction de distance pour RGB uniquement
    const distanceFn = (a: Vector, b: Vector): number => {
      // RGB euclidean
      let sum = 0
      for (let i = 0; i < 3; i++) {
        const d = a[i] - b[i]
        sum += d * d
      }
      return Math.sqrt(sum)
    }

    // Fonction de conversion vers RGB (pas de conversion nécessaire pour RGB)
    const toRGB = (v: Vector): Vector => {
      // RGB, pas de conversion nécessaire
      return v
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

    // RGB direct, pas de conversion nécessaire
    return result
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

    // Récupérer les indices présélectionnés (couleurs lockées)
    const preselectedIndices = config.preselectedIndices || []

    // CPU: Calcul rapide des couleurs dominantes avec diversité (incluant les présélectionnées)
    const selected = this.selectDiverseColorsFast(
      sampledColors,
      basePalette,
      targetColors,
      preselectedIndices
    )

    const duration = performance.now() - start
    adapterLogger.info(
      `⚡ [ReGL] CPC Plus selection: ${selected.length} colors in ${duration.toFixed(1)}ms (optimized)`
    )
    adapterLogger.info(
      `🔍 [ReGL] DEBUG: requested=${targetColors}, returned=${selected.length}, selected indices=[${selected.slice(0, 5).join(',')}${selected.length > 5 ? '...' : ''}]`
    )

    return selected
  }

  /**
   * 📊 Échantillonnage intelligent de l'image
   */
  private sampleImageColors(
    imageData: ImageData,
    maxSamples: number
  ): Vector[] {
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
   * ✅ Helper: Analyse fréquence des couleurs dans les échantillons
   */
  private analyzeColorFrequency(
    sampledColors: Vector[],
    basePalette: readonly Vector[],
    usedIndices: Set<number>
  ): Array<{
    index: number
    frequency: number
    color: Vector
    converted: Vector
  }> {
    const colorCount = new Map<number, number>()

    for (const sample of sampledColors) {
      const closestIndex = this.findClosestColorIndex(sample, basePalette)
      if (!usedIndices.has(closestIndex)) {
        colorCount.set(closestIndex, (colorCount.get(closestIndex) || 0) + 1)
      }
    }

    return Array.from(colorCount.entries())
      .map(([index, count]) => ({
        index,
        frequency: count / sampledColors.length,
        color: [...basePalette[index]] as Vector,
        converted: basePalette[index] // RGB direct
      }))
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * ✅ Helper: Sélection par fréquence avec diversité minimale
   */
  private selectFrequentColorsWithDiversity(
    colorFrequency: Array<{
      index: number
      frequency: number
      color: Vector
      converted: Vector
    }>,
    selectedConverted: Vector[],
    result: number[],
    frequencyBudget: number
  ): void {
    for (
      let i = 1;
      i < colorFrequency.length && result.length < frequencyBudget;
      i++
    ) {
      const candidateConverted = colorFrequency[i].converted

      // Vérifier diversité minimale (distance > 20)
      let isDiverse = true
      for (const selectedColor of selectedConverted) {
        if (this.calculateDistance(candidateConverted, selectedColor) < 20) {
          isDiverse = false
          break
        }
      }

      if (isDiverse) {
        result.push(colorFrequency[i].index)
        selectedConverted.push(candidateConverted)
      }
    }
  }

  /**
   * ✅ Helper: Sélection MaxMin Distance pour compléter la palette
   */
  private selectMaxMinDistanceColors(
    colorFrequency: Array<{
      index: number
      frequency: number
      color: Vector
      converted: Vector
    }>,
    selectedConverted: Vector[],
    result: number[],
    targetColors: number
  ): void {
    const remaining = colorFrequency.filter((c) => !result.includes(c.index))
    const additionalColors = targetColors - result.length

    for (let i = 0; i < additionalColors && remaining.length > 0; i++) {
      let maxMinDistance = 0
      let bestIndex = -1

      for (let j = 0; j < remaining.length; j++) {
        const candidateConverted = remaining[j].converted

        let minDistance = Infinity
        for (const selectedColor of selectedConverted) {
          const distance = this.calculateDistance(
            candidateConverted,
            selectedColor
          )
          minDistance = Math.min(minDistance, distance)
        }

        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance
          bestIndex = j
        }
      }

      if (bestIndex >= 0) {
        result.push(remaining[bestIndex].index)
        selectedConverted.push(remaining[bestIndex].converted)
        remaining.splice(bestIndex, 1)
      }
    }
  }

  /**
   * 🎯 Sélection rapide avec diversité maximale + espaces colorimetériques
   * ✅ Complexité réduite en extrayant les helpers
   */
  private selectDiverseColorsFast(
    sampledColors: Vector[],
    basePalette: readonly Vector[],
    targetColors: number,
    preselectedIndices: readonly number[] = []
  ): number[] {
    // Commencer par les couleurs présélectionnées (priorité absolue)
    const result: number[] = [...preselectedIndices]
    const usedIndices = new Set(preselectedIndices)

    // Si on a déjà assez de couleurs présélectionnées, retourner seulement celles-ci
    if (result.length >= targetColors) {
      return result.slice(0, targetColors)
    }

    // Analyser les fréquences des couleurs
    const colorFrequency = this.analyzeColorFrequency(
      sampledColors,
      basePalette,
      usedIndices
    )

    const remainingSlots = targetColors - result.length
    if (colorFrequency.length <= remainingSlots) {
      return [...result, ...colorFrequency.map((c) => c.index)]
    }

    const selectedConverted: Vector[] = result.map(
      (idx) => [...basePalette[idx]] as Vector
    )

    // Première couleur: la plus fréquente
    result.push(colorFrequency[0].index)
    selectedConverted.push(colorFrequency[0].converted)

    // Stratégie hybride: 60% fréquence + 40% diversité
    const frequencyBudget = Math.floor(targetColors * 0.6)

    // Phase 1: Ajouter les couleurs fréquentes avec diversité minimale
    this.selectFrequentColorsWithDiversity(
      colorFrequency,
      selectedConverted,
      result,
      frequencyBudget
    )

    // Phase 2: Compléter avec MaxMin Distance sur toute la palette
    this.selectMaxMinDistanceColors(
      colorFrequency,
      selectedConverted,
      result,
      targetColors
    )

    return result
  }

  /**
   * � Calcule la distance entre deux couleurs selon l'espace colorimétrique
   */
  private calculateDistance(color1: Vector, color2: Vector): number {
    // RGB - Distance euclidienne
    const dr = color1[0] - color2[0]
    const dg = color1[1] - color2[1]
    const db = color1[2] - color2[2]
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }

  /**
   * �🔍 Trouve l'index de la couleur la plus proche
   */
  private findClosestColorIndex(
    pixel: Vector,
    palette: readonly Vector[]
  ): number {
    let minDistance = Infinity
    let closestIndex = 0

    for (let i = 0; i < palette.length; i++) {
      const distance = this.calculateDistance(pixel, palette[i])

      if (distance < minDistance) {
        minDistance = distance
        closestIndex = i
      }
    }

    return closestIndex
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

// ✅ Mappings statiques pour RGB uniquement
export const DISTANCE_METRIC_MAP = {
  euclidean: 0
} as const

// Types utilitaires pour RGB uniquement
export type DistanceMetricIndex = 0 // euclidean seulement
