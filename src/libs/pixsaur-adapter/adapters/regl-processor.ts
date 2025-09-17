/**
 * Adaptateur ReGL pour le traitement d'images
 * Phase 1: Infrastructure ReGL avec ReGLQuantizer intégré et fallback CPU
 * ReGL simplifiera la gestion WebGL quand l'implémentation GPU sera prête
 */

import type REGL from 'regl'
import type { DistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import type { ColorSpace, Vector } from '@/libs/pixsaur-color/src/type'
import { adapterLogger, paletteLogger, quantizerLogger } from '@/utils/logger'
import type { AdjustmentConfig, ImageProcessor } from '../interfaces'
import { ReGLQuantizer } from './regl-quantizer'

/**
 * Adaptateur ReGL pour le traitement d'images
 * Phase 1: Infrastructure ReGL prête avec fallback CPU
 */
export class ReGLProcessor implements ImageProcessor {
  readonly type = 'regl' as const
  readonly isAvailable: boolean

  // ReGL et quantizer (Phase 1: préparation pour GPU)
  private readonly quantizer?: ReGLQuantizer

  // Capacités détectées
  private readonly reglCapabilities: {
    canUseReGL: boolean
    webglVersion: string | null
    maxTextureSize: number
  }

  constructor(regl?: REGL.Regl) {
    // Évaluer si ReGL pourrait être utilisé
    this.reglCapabilities = this.evaluateReGLCapabilities()

    // Phase 1: Setup optionnel de ReGL
    if (regl && this.reglCapabilities.canUseReGL) {
      try {
        this.quantizer = new ReGLQuantizer(regl)
        adapterLogger.info(
          '✅ [ADAPTER] ReGL quantizer initialized successfully'
        )
      } catch (error) {
        adapterLogger.warn(
          '⚠️ [ADAPTER] ReGL quantizer initialization failed, using CPU fallback',
          error
        )
        this.quantizer = undefined
      }
    }

    // Toujours disponible avec fallback CPU
    this.isAvailable = true

    adapterLogger.info(
      `🎮 [ADAPTER] ReGL processor initialized: GPU=${!!this.quantizer}, capabilities=${this.reglCapabilities.canUseReGL}`
    )
  }

  /**
   * Évalue les capacités WebGL pour future utilisation ReGL
   */
  private evaluateReGLCapabilities(): {
    canUseReGL: boolean
    webglVersion: string | null
    maxTextureSize: number
  } {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')

      if (gl) {
        const version =
          gl instanceof WebGL2RenderingContext ? 'WebGL 2.0' : 'WebGL 1.0'
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)

        adapterLogger.debug(
          `🔍 [ADAPTER] WebGL capabilities detected: ${version}, max texture: ${maxTextureSize}px`
        )

        return {
          canUseReGL: true,
          webglVersion: version,
          maxTextureSize
        }
      } else {
        adapterLogger.debug('🔍 [ADAPTER] No WebGL support detected')
        return {
          canUseReGL: false,
          webglVersion: null,
          maxTextureSize: 0
        }
      }
    } catch (error) {
      adapterLogger.warn(
        '⚠️ [ADAPTER] Error evaluating WebGL capabilities:',
        error
      )
      return {
        canUseReGL: false,
        webglVersion: null,
        maxTextureSize: 0
      }
    }
  }

  /**
   * Applique les ajustements d'image avec CPU fallback
   * FUTURE ENHANCEMENT: Remplacer par vraie accélération ReGL dans le futur
   */
  async applyAdjustments(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): Promise<ImageData> {
    return adapterLogger.timeAsync(
      'ReGL Image Adjustments (CPU fallback)',
      async () => {
        adapterLogger.debug(
          `🎨 [ADAPTER] Applying adjustments via ReGL processor (CPU fallback): brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}, posterization=${adjustments.posterization}`
        )

        if (this.reglCapabilities.canUseReGL) {
          adapterLogger.debug(
            '🎮 [ADAPTER] ReGL capable system detected, using optimized CPU processing'
          )
        } else {
          adapterLogger.debug(
            '💻 [ADAPTER] ReGL not available, using standard CPU processing'
          )
        }

        // Utiliser CPU processing pour l'instant
        const config = {
          rgb: adjustments.rgb,
          brightness: adjustments.brightness,
          contrast: adjustments.contrast,
          saturation: adjustments.saturation,
          posterization: adjustments.posterization
        }

        return applyAdjustmentsInOnePass(imageData, config)
      }
    )
  }

  /**
   * Version synchrone pour compatibility avec Jotai atoms
   */
  applyAdjustmentsSync(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    adapterLogger.debug(
      `🎨 [ADAPTER] Applying adjustments via ReGL processor (sync CPU fallback): brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}, posterization=${adjustments.posterization}`
    )

    const config = {
      rgb: adjustments.rgb,
      brightness: adjustments.brightness,
      contrast: adjustments.contrast,
      saturation: adjustments.saturation,
      posterization: adjustments.posterization
    }

    if (this.reglCapabilities.canUseReGL) {
      adapterLogger.debug(
        '🎮 [ADAPTER] ReGL capable system, using optimized CPU processing (sync)'
      )
    }

    return applyAdjustmentsInOnePass(imageData, config)
  }

  /**
   * Quantification de palette avec ReGL ou CPU fallback
   * Phase 1: Utilise ReGLQuantizer si disponible, sinon fallback CPU
   */
  async quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData | { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    colorSpace: ColorSpace
  ): Promise<Vector[]> {
    return adapterLogger.timeAsync('ReGL Palette Quantization', async () => {
      adapterLogger.debug(
        `🎯 [ADAPTER] Starting ReGL quantization: colorSpace=${colorSpace}, targetColors=${targetColors}, bufferSize=${buffer.length}`
      )

      // Déterminer la métrique de distance basée sur l'espace colorimétrique
      const distanceMetric: DistanceMetric =
        colorSpace === 'Lab' ? 'cie76' : 'euclidean'

      // Extraire dimensions depuis imageData
      const dimensions =
        'data' in imageData
          ? { width: imageData.width, height: imageData.height }
          : imageData

      // Phase 1: Utiliser ReGLQuantizer si disponible
      if (this.quantizer && this.shouldUseReGLQuantizer(buffer, dimensions)) {
        try {
          adapterLogger.debug('🎮 [ADAPTER] Using ReGL quantizer')

          const fullImageData =
            'data' in imageData
              ? imageData
              : new ImageData(
                  new Uint8ClampedArray(buffer),
                  imageData.width,
                  imageData.height
                )

          const result = await this.quantizer.quantizePalette(
            buffer,
            fullImageData,
            basePalette,
            preselected,
            {
              colorSpace,
              distanceMetric,
              targetColors,
              gpuOptions: {
                minPixelsForGPU: 128 * 128 // GPU avantageux pour images moyennes+
              }
            }
          )

          return [...result] // Conversion readonly -> mutable pour compatibilité
        } catch (error) {
          adapterLogger.warn(
            '⚠️ [ADAPTER] ReGL quantization failed, falling back to CPU',
            error
          )
          // Continue vers fallback CPU
        }
      }

      // Fallback CPU (existant)
      adapterLogger.debug('🖥️ [ADAPTER] Using CPU quantization fallback')

      return this.quantizePaletteOptimized(
        buffer,
        dimensions,
        targetColors,
        basePalette,
        preselected,
        colorSpace,
        distanceMetric
      )
    })
  }

  /**
   * Détermine si utiliser ReGL quantizer selon les conditions
   */
  private shouldUseReGLQuantizer(
    _buf: Uint8ClampedArray,
    cropped: { width: number; height: number }
  ): boolean {
    if (!this.quantizer || !this.reglCapabilities.canUseReGL) {
      return false
    }

    const pixels = cropped.width * cropped.height
    const minPixelsForReGL = 64 * 64 // Seuil bas pour Phase 1

    const shouldUse = pixels >= minPixelsForReGL

    adapterLogger.debug(
      `🤔 [ADAPTER] ReGL decision: ${pixels} pixels, min=${minPixelsForReGL}, shouldUse=${shouldUse}`
    )

    return shouldUse
  }

  /**
   * Quantification optimisée (préparation pour future ReGL)
   */
  private async quantizePaletteOptimized(
    buffer: Uint8ClampedArray,
    _dimensions: { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    colorSpace: ColorSpace,
    distanceMetric: DistanceMetric
  ): Promise<Vector[]> {
    quantizerLogger.debug(
      `📊 [ADAPTER] Creating ReGL-ready quantizer with metric: ${distanceMetric}, basePalette=${basePalette.length} colors, preselected=${preselected.length} colors`
    )

    const startTime = performance.now()

    // Utiliser la signature correcte de createQuantizer
    const quantizer = createQuantizer({
      buf: buffer,
      basePalette,
      preselected,
      quantConfig: {
        colorSpace,
        distanceMetric
      }
    })

    const creationTime = performance.now()
    quantizerLogger.debug(
      `🔧 [ADAPTER] Quantizer Creation: ${(creationTime - startTime).toFixed(2)}ms`
    )

    const quantStart = performance.now()

    // Utiliser la signature correcte de quantize
    const palette = quantizer.quantize(targetColors)

    const quantEnd = performance.now()
    quantizerLogger.debug(
      `⚡ [ADAPTER] Quantization Process: ${(quantEnd - quantStart).toFixed(2)}ms`
    )

    paletteLogger.debug(
      `🎨 [ADAPTER] Quantization completed via ReGL adapter (CPU): ${palette.length}/${targetColors} colors for ${colorSpace}`
    )

    if (palette.length !== targetColors) {
      paletteLogger.warn(
        `⚠️ [ADAPTER] Expected ${targetColors} colors but got ${palette.length} for ${colorSpace}`
      )
    }

    return palette
  }

  /**
   * Libération des ressources (CPU et ReGL)
   */
  dispose(): void {
    try {
      this.quantizer?.dispose()
      adapterLogger.debug(
        '🗑️ [ADAPTER] ReGL Processor disposed (GPU resources cleaned)'
      )
    } catch (error) {
      adapterLogger.error(
        '❌ [ADAPTER] Error during ReGL processor disposal',
        error
      )
    }
  }

  /**
   * Obtient des informations sur les capacités ReGL actuelles et futures
   */
  getCapabilities(): {
    currentMode: 'cpu-fallback'
    futureReGLCapable: boolean
    webglVersion: string | null
    maxTextureSize: number
  } {
    return {
      currentMode: 'cpu-fallback',
      futureReGLCapable: this.reglCapabilities.canUseReGL,
      webglVersion: this.reglCapabilities.webglVersion,
      maxTextureSize: this.reglCapabilities.maxTextureSize
    }
  }
}
