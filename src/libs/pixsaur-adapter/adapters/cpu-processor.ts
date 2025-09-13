import type { Vector } from '@/libs/pixsaur-color/src/type'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import { createQuantizer } from '@/libs/pixsaur-color/src'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { ColorSpaceDistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import type { ImageProcessor, AdjustmentConfig } from '../interfaces'

/**
 * Implémentation CPU du processor d'image
 * Wraps les fonctions existantes sans changer la logique
 */
export class CpuImageProcessor implements ImageProcessor {
  readonly type = 'cpu' as const
  readonly isAvailable = true

  async applyAdjustments(
    imageData: ImageData, 
    adjustments: AdjustmentConfig
  ): Promise<ImageData> {
    return this.applyAdjustmentsSync(imageData, adjustments)
  }

  /**
   * Version synchrone pour compatibilité avec les atoms Jotai existants
   */
  applyAdjustmentsSync(
    imageData: ImageData, 
    adjustments: AdjustmentConfig
  ): ImageData {
    console.time('🖥️ CPU Image Adjustments')
    
    const result = applyAdjustmentsInOnePass(imageData, adjustments)
    
    console.timeEnd('🖥️ CPU Image Adjustments')
    return result
  }

  async quantizePalette(
    buffer: Uint8ClampedArray,
    _imageData: ImageData,
    targetColors: number,
    basePalette?: Vector[],
    preselected?: Vector[],
    colorSpace: string = 'RGB'
  ): Promise<Vector[]> {
    console.time('🖥️ CPU Palette Quantization')
    
    // Utilise la logique existante
    const availableMetrics = ColorSpaceDistanceMetric[colorSpace as keyof typeof ColorSpaceDistanceMetric]
    const distanceMetric = availableMetrics?.[0] || ColorSpaceDistanceMetric.RGB[0]

    const quantizer = createQuantizer({
      buf: buffer,
      basePalette: basePalette || generateAmstradCPCPalette(),
      preselected: preselected || [],
      quantConfig: {
        colorSpace: colorSpace as keyof typeof ColorSpaceDistanceMetric,
        distanceMetric
      }
    })

    const result = quantizer.quantize(targetColors)
    
    console.timeEnd('🖥️ CPU Palette Quantization')
    return result.map(v => [...v] as Vector)
  }

  dispose(): void {
    // Rien à nettoyer pour le CPU
  }
}