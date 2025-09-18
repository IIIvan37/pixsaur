// Import pour accéder à l'atome de stratégie de contraste
import { getDefaultStore } from 'jotai'
import { contrastStrategyAtom } from '@/app/store/config/config'
import { createQuantizer } from '@/libs/pixsaur-color/src'
import { ColorSpaceDistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import type { ColorSpace, Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { adapterLogger, paletteLogger, quantizerLogger } from '@/utils/logger'
import type { AdjustmentConfig, ImageProcessor } from '../interfaces'

/**
 * Implémentation CPU du processor d'image
 * Wraps les fonctions existantes sans changer la logique
 */
export class CpuImageProcessor implements ImageProcessor {
  readonly type = 'cpu' as const
  readonly isAvailable = true

  constructor() {
    adapterLogger.info('🏗️ CPU Processor instance created')
  }

  async applyAdjustments(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): Promise<ImageData> {
    adapterLogger.debug(
      '🔄 CPU async adjustments called, delegating to sync version'
    )
    return this.applyAdjustmentsSync(imageData, adjustments)
  }

  /**
   * Version synchrone pour compatibilité avec les atoms Jotai existants
   */
  applyAdjustmentsSync(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    return adapterLogger.timeSync('🖥️ [ADAPTER] CPU Image Adjustments', () => {
      adapterLogger.info(
        `🎨 [ADAPTER] Applying adjustments via CPU processor: brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}, posterization=${adjustments.posterization}`
      )
      const result = applyAdjustmentsInOnePass(imageData, adjustments)
      adapterLogger.debug(
        `✅ [ADAPTER] CPU adjustments completed: ${imageData.width}x${imageData.height} → ${result.width}x${result.height}`
      )
      return result
    })
  }

  async quantizePalette(
    buffer: Uint8ClampedArray,
    _imageData: ImageData | { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    colorSpace: ColorSpace
  ): Promise<Vector[]> {
    adapterLogger.info(
      `🎯 [ADAPTER] Starting CPU quantization via adapter: colorSpace=${colorSpace}, targetColors=${targetColors}, bufferSize=${buffer.length}`
    )

    return adapterLogger.timeAsync(
      '🖥️ [ADAPTER] CPU Palette Quantization',
      async () => {
        quantizerLogger.time('🔧 [ADAPTER] Quantizer Creation')

        // Utilise la logique existante
        const availableMetrics = ColorSpaceDistanceMetric[colorSpace]
        const distanceMetric =
          availableMetrics?.[0] || ColorSpaceDistanceMetric.RGB[0]

        quantizerLogger.info(
          `📊 [ADAPTER] Creating quantizer with metric: ${distanceMetric}, basePalette=${basePalette?.length || 0} colors, preselected=${preselected?.length || 0} colors`
        )

        const quantizer = createQuantizer({
          buf: buffer,
          basePalette: basePalette || generateAmstradCPCPalette(),
          preselected: preselected || [],
          quantConfig: {
            colorSpace,
            distanceMetric,
            contrastStrategy: getDefaultStore().get(contrastStrategyAtom)
          }
        })

        quantizerLogger.timeEnd('🔧 [ADAPTER] Quantizer Creation')
        quantizerLogger.time('⚡ [ADAPTER] Quantization Process')

        const result = quantizer.quantize(targetColors)

        quantizerLogger.timeEnd('⚡ [ADAPTER] Quantization Process')
        paletteLogger.info(
          `🎨 [ADAPTER] Quantization completed via adapter: ${result.length}/${targetColors} colors for ${colorSpace}`
        )

        if (result.length !== targetColors) {
          paletteLogger.warn(
            `⚠️ [ADAPTER] Expected ${targetColors} colors but got ${result.length} for ${colorSpace}`
          )
        }

        return result.map((v) => [...v] as Vector)
      }
    )
  }

  dispose(): void {
    adapterLogger.info('🗑️ [ADAPTER] CPU Processor disposed')
    // Rien à nettoyer pour le CPU
  }
}
