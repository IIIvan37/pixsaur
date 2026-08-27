/**
 * Quantization atoms for preview pipeline.
 *
 * Handles color quantization using the palette processor:
 * - Creates quantizer from image buffer
 * - Produces raw and RGB-quantized palettes
 * - Applies CPC hardware-specific color quantization
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import { getPaletteForHardware } from '@/domain/cpc'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { DISTANCE_METRICS_BY_COLORSPACE } from '@/libs/pixsaur-color/src/metric/distance'
import { countUniqueColors } from '@/libs/pixsaur-color/src/utils/count-unique-colors'
import { quantizePalette } from '@/preview/application/quantize-palette'
import { imageProcessorAtom } from '../../adapters/processors'
import {
  autoDistinctMappingAtom,
  colorDiversityAtom,
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  paletteStrategyAtom
} from '../../config/config'
import {
  lockedEmptySlotsCountAtom,
  lockedVectorsAtom
} from '../../palette/palette'
import { croppedImageAtom } from './image-pipeline'

// ============================================================================
// BUFFER EXTRACTION
// ============================================================================

/**
 * Image source for palette quantization.
 *
 * IMPORTANT: In 'origin' mode, we use croppedImageAtom (before resize/padding)
 * to avoid the black padding pixels from dominating the palette.
 * In 'auto' and 'cover' modes, we also use croppedImageAtom for better color sampling
 * at high resolution. This ensures consistent palette extraction regardless of resize mode.
 */
export const quantizationSourceImageAtom = atom(async (get) => {
  // Use cropped image (before resize) for all modes
  // This provides better color sampling at high resolution
  // and ensures consistent results between auto/cover for images that fit perfectly
  return await get(croppedImageAtom)
})

/**
 * Extracts RGBA buffer from the quantization source image.
 */
export const croppedBufferAtom = atom(async (get) => {
  const sourceImage = await get(quantizationSourceImageAtom)
  if (!sourceImage) {
    return null
  }
  return extractBuffer(sourceImage)
})

/**
 * Count of unique colors in the source image.
 * Returns the count up to 17 (we only care if ≤16 for distinct-mapping).
 * Used to determine if distinct-mapping should be applied.
 */
export const sourceUniqueColorsCountAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  if (!buf) {
    return null
  }
  // Count up to 17 colors (we just want to know if ≤16)
  return countUniqueColors(buf, 17)
})

// ============================================================================
// QUANTIZER
// ============================================================================

/**
 * Creates a quantizer for the current image and configuration.
 * The quantizer is used for both palette extraction and dithering.
 */
export const quantizerAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const sourceImage = await get(quantizationSourceImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = 'RGB' // Fixed to RGB
  const cpcHardware = get(cpcHardwareAtom)
  if (!buf || !sourceImage) {
    return null
  }

  const availableMetrics = DISTANCE_METRICS_BY_COLORSPACE[colorSpace]
  const distanceMetric = availableMetrics[0]

  return createQuantizer({
    buf,
    basePalette: getPaletteForHardware(cpcHardware),
    preselected: lockedVecs,
    quantConfig: {
      distanceMetric
    }
  })
})

// ============================================================================
// PALETTE QUANTIZATION
// ============================================================================

/**
 * Thin adapter over the `quantizePalette` use-case
 * (`@/preview/application/quantize-palette`). Assembles the input from atoms,
 * injects the real quantizer (`imageProcessorAtom`), and exposes the result;
 * the raw / RGB palette atoms below select their field from it.
 *
 * Returns `null` when there is no source image or the processor is not yet
 * initialized — the public atoms map that to an empty palette.
 */
const quantizedPaletteAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const sourceImage = await get(quantizationSourceImageAtom)
  if (!buf || !sourceImage) {
    return null
  }

  const quantizer = get(imageProcessorAtom)
  if (!quantizer) {
    logger.warn('Palette processor not initialized')
    return null
  }

  const result = await quantizePalette(
    {
      buf,
      sourceImage,
      lockedVecs: get(lockedVectorsAtom),
      cpcHardware: get(cpcHardwareAtom),
      modeConfig: get(effectiveModeConfigAtom),
      lockedEmptyCount: get(lockedEmptySlotsCountAtom),
      paletteStrategy: get(paletteStrategyAtom),
      autoDistinctMapping: get(autoDistinctMappingAtom),
      colorDiversity: get(colorDiversityAtom)
    },
    { quantizer }
  )

  return result.ok ? result : null
})

/**
 * Source-colour → palette-index mapping produced by the `distinct-mapping`
 * strategy, or `null`. Rides alongside the palette so `previewImageAtom` can
 * hand it to `ditherImage` explicitly.
 */
export const sourceColorMappingAtom = atom(async (get) => {
  const result = await get(quantizedPaletteAtom)
  return result ? result.sourceColorMapping : null
})

/**
 * Raw quantized palette from the palette processor.
 * Colors are in RGB format but not yet hardware-quantized.
 */
export const reducedPaletteRawAtom = atom(async (get) => {
  const result = await get(quantizedPaletteAtom)
  return result ? result.rawPalette : []
})

/**
 * RGB-quantized palette ready for display.
 * Colors are quantized according to CPC hardware (Classic: 27 colors, Plus: 4096 colors).
 */
export const reducedPaletteRgbAtom = atom(async (get) => {
  const result = await get(quantizedPaletteAtom)
  return result ? result.rgbPalette : []
})
