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
   * Quantification GPU (Phase 1: Placeholder pour infrastructure)
   */
  private async quantizeGPU(
    buffer: Uint8ClampedArray,
    imageData: ImageData,
    basePalette: readonly Vector[],
    preselected: readonly Vector[],
    config: ReGLQuantizeConfig
  ): Promise<readonly Vector[]> {
    adapterLogger.debug('🎮 [ReGL] Starting GPU quantization')

    // Phase 1: Pour l'instant, utilise CPU mais avec l'infrastructure GPU
    // Phase 2: Implémentation réelle du pipeline GPU

    const gpuStart = performance.now()

    try {
      // Upload vers GPU (simulation pour Phase 1)
      this.updateInputTexture(imageData)
      this.updatePaletteTexture(basePalette)

      // Pour Phase 1: Utilise CPU mais log comme GPU pour tester l'infrastructure
      const result = await this.quantizeCPU(
        buffer,
        basePalette,
        preselected,
        config
      )

      const gpuTime = performance.now() - gpuStart
      adapterLogger.debug(
        `🎮 [ReGL] GPU path completed in ${gpuTime.toFixed(2)}ms (Phase 1: CPU backend)`
      )

      return result
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

      // Placeholder command pour Phase 1
      this.histogramCommand = this.regl({
        frag: `
          precision mediump float;
          void main() {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
          }
        `,
        vert: `
          attribute vec2 position;
          void main() {
            gl_Position = vec4(position, 0.0, 1.0);
          }
        `,
        attributes: {
          position: [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
          ]
        },
        primitive: 'triangle strip',
        count: 4
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
