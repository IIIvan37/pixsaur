/**
 * CPU implementation of {@link ImageProcessor}.
 *
 * Pure JS/TS — no WebGL, no `regl`, nothing to release. It is both the
 * processor used when the user picks `'cpu'` and the fallback the factory
 * returns when the GPU pipeline cannot be built; {@link GpuProcessor} also
 * delegates to it for the steps that have no shader (chroma key, median) and
 * when the GPU quantizer refuses an image.
 */

import { adapterLogger, paletteLogger } from '@/core'
import type { DistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import {
  applyChromaKey,
  applyConvolutionFilters,
  applyMedianFilter,
  applySobelEdgeDetection
} from '../cpu-convolution'
import type {
  AdjustmentConfig,
  ImageProcessor,
  PaletteStrategy,
  QuantizationOptions
} from '../interfaces'

/** RGB is the only colorspace the pipeline quantizes in. */
const DISTANCE_METRIC: DistanceMetric = 'euclidean'

/**
 * The two filters that have no shader and therefore run on the CPU whichever
 * processor is in use: chroma key (background removal) first, so the keyed-out
 * pixels are black before anything else touches them, then the median filter
 * (a per-pixel sort, not expressible in a simple fragment shader).
 */
export function applyCpuOnlyFilters(
  imageData: ImageData,
  adjustments: AdjustmentConfig
): ImageData {
  let result = imageData

  const chromaKeyEnabled = adjustments.chromaKeyEnabled ?? 0
  const chromaKeyColor = adjustments.chromaKeyColor
  const chromaKeyTolerance = adjustments.chromaKeyTolerance ?? 30
  if (chromaKeyEnabled && chromaKeyColor) {
    result = applyChromaKey(result, chromaKeyColor, chromaKeyTolerance)
  }

  const median = adjustments.median ?? 0
  if (median !== 0) {
    result = applyMedianFilter(result, median)
  }

  return result
}

/** Narrows the full adjustment config to the colorimetric subset. */
function toColorAdjustments(adjustments: AdjustmentConfig) {
  return {
    rgb: adjustments.rgb,
    brightness: adjustments.brightness,
    contrast: adjustments.contrast,
    saturation: adjustments.saturation,
    hue: adjustments.hue,
    vibrance: adjustments.vibrance,
    temperature: adjustments.temperature,
    tint: adjustments.tint,
    gamma: adjustments.gamma,
    exposure: adjustments.exposure,
    highlights: adjustments.highlights,
    shadows: adjustments.shadows,
    posterization: adjustments.posterization
  }
}

export class CpuProcessor implements ImageProcessor {
  readonly type = 'cpu' as const

  applyAdjustments(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    let result = applyCpuOnlyFilters(imageData, adjustments)

    result = applyAdjustmentsInOnePass(result, toColorAdjustments(adjustments))

    const sharpen = adjustments.sharpen ?? 0
    const blur = adjustments.blur ?? 0
    if (sharpen !== 0 || blur !== 0) {
      result = applyConvolutionFilters(result, sharpen, blur)
    }

    const edges = adjustments.edges ?? 0
    if (edges !== 0) {
      result = applySobelEdgeDetection(result, edges)
    }

    return result
  }

  /**
   * @param _options - `autoDistinctMapping` / `colorDiversity` reach this
   *   processor but are not honoured yet: `createQuantizer` decides the
   *   `distinct-mapping` switch from the image itself and has no diversity
   *   parameter. Wiring them through the pure quantizer changes rendering, so
   *   it is a behaviour change, not part of this split — see
   *   `docs/refactor/STATUS.md`.
   */
  async quantizePalette(
    buffer: Uint8ClampedArray,
    _imageData: ImageData | { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    paletteStrategy?: PaletteStrategy,
    _options?: QuantizationOptions
  ): Promise<Vector[]> {
    const quantizer = createQuantizer({
      buf: buffer,
      basePalette,
      preselected,
      quantConfig: {
        distanceMetric: DISTANCE_METRIC,
        paletteStrategy: paletteStrategy ?? 'exhaustive-contrast'
      }
    })

    const palette = quantizer.quantize(targetColors)

    if (palette.length !== targetColors) {
      paletteLogger.warn(
        `[ADAPTER] Expected ${targetColors} colors but got ${palette.length} for RGB`
      )
    }

    return palette
  }

  renderRasterPreview(
    indexBuffer: Uint8Array,
    width: number,
    height: number,
    globalPalette: Vector[],
    rasterChanges: RasterChange[]
  ): ImageData {
    adapterLogger.info(
      `[RASTER] Rendering raster preview via CPU (${width}x${height}, ${rasterChanges.length} changes)`
    )
    return createRasterPreviewImageData(
      indexBuffer,
      width,
      height,
      globalPalette,
      rasterChanges
    )
  }

  /** Nothing to release — the CPU processor holds no GPU resource. */
  dispose(): void {}
}
