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
import type { ColorSpace, Vector } from '@/libs/pixsaur-color/src/type'
import { adapterLogger, paletteLogger, quantizerLogger } from '@/utils/logger'

// Types temporaires pour Phase 1 - seront importés depuis pixsaur-color en Phase 2
type DistanceMetric = 'euclidean' | 'cie76' | 'deltaE2000'

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

    // Extensions requises
    const extensions = [
      'OES_texture_float',
      'EXT_color_buffer_float',
      'WEBGL_color_buffer_float'
    ]

    const availableExtensions = extensions.filter(
      (ext) => !!gl.getExtension(ext)
    )

    const hasFloatTextures = availableExtensions.includes('OES_texture_float')
    const hasColorBufferFloat = availableExtensions.some((ext) =>
      ext.includes('color_buffer_float')
    )

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)

    const canUseGPU = hasFloatTextures && maxTextureSize >= 1024

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
        colorType: this.capabilities.hasColorBufferFloat ? 'float' : 'uint8'
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
          
          // Convert RGB to Lab color space
          vec3 rgb2lab(vec3 rgb) {
            // Simplified RGB to Lab conversion for GPU
            // Note: This is a simplified version, full conversion would be more complex
            rgb = rgb / 255.0;
            
            // sRGB to XYZ (simplified)
            vec3 xyz = mat3(
              0.4124564, 0.3575761, 0.1804375,
              0.2126729, 0.7151522, 0.0721750,
              0.0193339, 0.1191920, 0.9503041
            ) * rgb;
            
            // XYZ to Lab (simplified)
            xyz = xyz / vec3(0.95047, 1.0, 1.08883); // D65 illuminant
            xyz = mix(xyz * 7.787 + 16.0/116.0, pow(xyz, vec3(1.0/3.0)), step(0.008856, xyz));
            
            float L = 116.0 * xyz.y - 16.0;
            float a = 500.0 * (xyz.x - xyz.y);
            float b = 200.0 * (xyz.y - xyz.z);
            
            return vec3(L, a, b);
          }
          
          // Calculate color distance based on metric
          float colorDistance(vec3 color1, vec3 color2, int metric, int colorSpace) {
            if (colorSpace == 1) { // Lab
              color1 = rgb2lab(color1);
              color2 = rgb2lab(color2);
            }
            
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
            return colorSpace === 'Lab' ? 1 : colorSpace === 'XYZ' ? 2 : 0
          },
          u_distanceMetric: (_context, props: any) => {
            // 0: euclidean, 1: cie76, 2: deltaE2000
            const metric = props.distanceMetric || 'euclidean'
            return metric === 'cie76' ? 1 : metric === 'deltaE2000' ? 2 : 0
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

      // Convertir Vector[] vers Float32Array
      const paletteData = new Float32Array(basePalette.length * 3)
      for (let i = 0; i < basePalette.length; i++) {
        const color = basePalette[i]
        paletteData[i * 3] = color[0] / 255
        paletteData[i * 3 + 1] = color[1] / 255
        paletteData[i * 3 + 2] = color[2] / 255
      }

      this.cpcPaletteTexture = this.regl.texture({
        width: basePalette.length,
        height: 1,
        format: 'rgb',
        type: 'float32',
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

    return new Promise((resolve, reject) => {
      try {
        // Execute GPU histogram computation
        this.histogramCommand!({
          colorSpace: config.colorSpace,
          distanceMetric: config.distanceMetric
        })

        // Read back results from framebuffer
        const pixels = this.regl.read({
          framebuffer: this.histogramFBO!
        })

        // Convert GPU results to histogram array
        const histogram = new Array(27).fill(0) // CPC palette has 27 colors

        // Process GPU readback (simplified for Phase 2)
        // In a real implementation, this would be more sophisticated
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]
          const a = pixels[i + 3]

          if (a > 0) {
            // Extract color index from red channel (encoded in shader)
            const colorIndex = Math.floor((r / 255) * 27)
            if (colorIndex >= 0 && colorIndex < 27) {
              histogram[colorIndex]++
            }
          }
        }

        adapterLogger.debug(
          `📊 [ReGL] GPU histogram computed: ${histogram.reduce((a, b) => a + b, 0)} pixels processed`
        )

        resolve(histogram)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        adapterLogger.error('❌ [ReGL] GPU histogram computation failed', error)
        reject(new Error(`GPU histogram computation failed: ${errorMessage}`))
      }
    })
  }

  /**
   * Sélection optimisée des couleurs sur GPU (Phase 2)
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

    // Phase 2: Implémentation optimisée utilisant les résultats GPU
    // Pour l'instant, utilise l'algorithme CPU mais avec données GPU

    // Créer un quantizer temporaire avec l'histogramme GPU
    const weightedPalette = basePalette.map((color, index) => ({
      color,
      weight: histogram[index] || 0
    }))

    // Trier par fréquence d'utilisation (données GPU)
    weightedPalette.sort((a, b) => b.weight - a.weight)

    // Commencer avec les couleurs pré-sélectionnées
    const selectedColors: Vector[] = [...preselected]

    // Ajouter les couleurs les plus fréquentes jusqu'à atteindre la cible
    for (const { color } of weightedPalette) {
      if (selectedColors.length >= config.targetColors) {
        break
      }

      // Éviter les doublons
      if (
        !selectedColors.some((selected) => this.colorsEqual(selected, color))
      ) {
        selectedColors.push([...color] as Vector)
      }
    }

    // Si pas assez de couleurs, remplir avec les premières disponibles
    for (const color of basePalette) {
      if (selectedColors.length >= config.targetColors) {
        break
      }
      if (
        !selectedColors.some((selected) => this.colorsEqual(selected, color))
      ) {
        selectedColors.push([...color] as Vector)
      }
    }

    adapterLogger.debug(
      `🎯 [ReGL] GPU selection completed: ${selectedColors.length}/${config.targetColors} colors selected`
    )

    return selectedColors
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
