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

        // Convertir la palette vers l'espace de travail comme le fait le GPU
        const paletteToUse = basePalette || generateAmstradCPCPalette()
        let convertedPalette: Vector[]

        if (colorSpace === 'Lab') {
          convertedPalette = paletteToUse.map((color) => {
            // Convertir RGB vers Lab
            const [r, g, b] = color.map((c) => c / 255)

            // RGB vers XYZ
            const gamma = (c: number) =>
              c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92
            const rLinear = gamma(r)
            const gLinear = gamma(g)
            const bLinear = gamma(b)

            const X =
              rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375
            const Y =
              rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.072175
            const Z =
              rLinear * 0.0193339 + gLinear * 0.119192 + bLinear * 0.9503041

            // XYZ vers Lab
            const XnValue = 0.95047
            const YnValue = 1.0
            const ZnValue = 1.08883

            const fx =
              X / XnValue > 0.008856
                ? (X / XnValue) ** (1 / 3)
                : (7.787 * X) / XnValue + 16 / 116
            const fy =
              Y / YnValue > 0.008856
                ? (Y / YnValue) ** (1 / 3)
                : (7.787 * Y) / YnValue + 16 / 116
            const fz =
              Z / ZnValue > 0.008856
                ? (Z / ZnValue) ** (1 / 3)
                : (7.787 * Z) / ZnValue + 16 / 116

            const L = 116 * fy - 16
            const a = 500 * (fx - fy)
            const b_lab = 200 * (fy - fz)

            return [L, a, b_lab] as Vector
          })
        } else if (colorSpace === 'XYZ') {
          convertedPalette = paletteToUse.map((color) => {
            // Convertir RGB vers XYZ
            const [r, g, b] = color.map((c) => c / 255)

            const gamma = (c: number) =>
              c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92
            const rLinear = gamma(r)
            const gLinear = gamma(g)
            const bLinear = gamma(b)

            const X =
              rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375
            const Y =
              rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.072175
            const Z =
              rLinear * 0.0193339 + gLinear * 0.119192 + bLinear * 0.9503041

            return [X, Y, Z] as Vector
          })
        } else {
          // RGB, pas de conversion
          convertedPalette = paletteToUse
        }

        const quantizer = createQuantizer({
          buf: buffer,
          basePalette: convertedPalette,
          preselected: preselected || [],
          quantConfig: {
            colorSpace,
            distanceMetric
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
