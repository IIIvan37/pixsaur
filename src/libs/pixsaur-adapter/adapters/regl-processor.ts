/**
 * Adaptateur ReGL pour le traitement d'images
 * Future implémentation GPU avec ReGL - pour l'instant utilise CPU comme fallback intelligent
 * ReGL simplifiera la gestion WebGL quand l'implémentation GPU sera prête
 */

import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { adapterLogger, paletteLogger, quantizerLogger } from '@/utils/logger'
import type { AdjustmentConfig, ImageProcessor } from '../interfaces'

// Types pour l'espace colorimétrique et métriques
type ColorSpace = 'RGB' | 'Lab' | 'XYZ'
type DistanceMetric = 'euclidean' | 'cie76' | 'deltaE2000'

/**
 * Adaptateur ReGL pour le traitement d'images
 * Future implémentation GPU - utilise CPU comme fallback intelligent pour l'instant
 */
export class ReGLProcessor implements ImageProcessor {
  readonly type = 'regl' as const
  readonly isAvailable: boolean

  // Préparation pour future intégration ReGL
  private reglCapabilities: {
    canUseReGL: boolean
    webglVersion: string | null
    maxTextureSize: number
  }

  constructor() {
    // Évaluer si ReGL pourrait être utilisé dans le futur
    this.reglCapabilities = this.evaluateReGLCapabilities()

    // Pour l'instant, toujours disponible avec fallback CPU
    this.isAvailable = true

    adapterLogger.info(
      `🎮 [ADAPTER] ReGL processor initialized (CPU fallback mode), future ReGL capable: ${this.reglCapabilities.canUseReGL}`
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
   * TODO: Remplacer par vraie accélération ReGL dans le futur
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
   * Quantification de palette avec CPU fallback
   * TODO: Intégrer ReGL compute-like shaders pour la quantification dans le futur
   */
  async quantizePalette(
    buf: Uint8ClampedArray,
    cropped: { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    lockedVecs: Vector[],
    colorSpace: ColorSpace
  ): Promise<Vector[]> {
    return adapterLogger.timeAsync(
      'ReGL Palette Quantization (CPU fallback)',
      async () => {
        adapterLogger.debug(
          `🎯 [ADAPTER] Starting ReGL quantization (CPU fallback): colorSpace=${colorSpace}, targetColors=${targetColors}, bufferSize=${buf.length}`
        )

        // Déterminer la métrique de distance basée sur l'espace colorimétrique
        const distanceMetric: DistanceMetric =
          colorSpace === 'Lab' ? 'cie76' : 'euclidean'

        if (this.reglCapabilities.canUseReGL) {
          adapterLogger.debug(
            '🎮 [ADAPTER] ReGL capable system, using optimized CPU quantization'
          )
        } else {
          adapterLogger.debug(
            '💻 [ADAPTER] ReGL not available, using standard CPU quantization'
          )
        }

        return this.quantizePaletteOptimized(
          buf,
          cropped,
          targetColors,
          basePalette,
          lockedVecs,
          colorSpace,
          distanceMetric
        )
      }
    )
  }

  /**
   * Quantification optimisée (préparation pour future ReGL)
   */
  private async quantizePaletteOptimized(
    buf: Uint8ClampedArray,
    _cropped: { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    lockedVecs: Vector[],
    colorSpace: ColorSpace,
    distanceMetric: DistanceMetric
  ): Promise<Vector[]> {
    quantizerLogger.debug(
      `📊 [ADAPTER] Creating ReGL-ready quantizer with metric: ${distanceMetric}, basePalette=${basePalette.length} colors, preselected=${lockedVecs.length} colors`
    )

    const startTime = performance.now()

    // Utiliser la signature correcte de createQuantizer
    const quantizer = createQuantizer({
      buf,
      basePalette,
      preselected: lockedVecs,
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
    const palette = await quantizer.quantize(targetColors)

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
   * Libération des ressources (pour compatibilité future)
   */
  dispose(): void {
    adapterLogger.debug(
      '🗑️ [ADAPTER] ReGL Processor disposed (CPU fallback mode)'
    )
    // Rien à nettoyer pour l'instant avec CPU fallback
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
