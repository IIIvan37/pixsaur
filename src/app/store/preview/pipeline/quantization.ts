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
import { quantifyToCPCPlus, quantizeCPC } from '@/domain/cpc'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { DISTANCE_METRICS_BY_COLORSPACE } from '@/libs/pixsaur-color/src/metric/distance'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { countUniqueColors } from '@/libs/pixsaur-color/src/utils/count-unique-colors'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import { paletteProcessorAtom } from '../../adapters/processors'
import {
  autoDistinctMappingAtom,
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
 * Raw quantized palette from the palette processor.
 * Colors are in RGB format but not yet hardware-quantized.
 */
export const reducedPaletteRawAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const sourceImage = await get(quantizationSourceImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const cpcHardware = get(cpcHardwareAtom)

  if (!buf || !sourceImage) {
    return []
  }

  const paletteProcessor = get(paletteProcessorAtom)
  if (!paletteProcessor) {
    logger.warn('Palette processor not initialized')
    return []
  }

  const basePalette = getPaletteForHardware(cpcHardware)
  const modeConfig = get(effectiveModeConfigAtom)
  const lockedEmptyCount = get(lockedEmptySlotsCountAtom)
  // Always request max colors for palette stability
  // We'll truncate after to exclude extra colors
  const targetColors = modeConfig.nColors

  logger.info('[Preview] Target colors calculation', {
    modeNColors: modeConfig.nColors,
    lockedEmptyCount,
    targetColors,
    lockedVecsCount: lockedVecs.length
  })

  // Quantify locked colors according to hardware BEFORE passing to quantizer
  const quantifiedLockedVecs =
    cpcHardware === 'plus'
      ? lockedVecs.map(
          (color) =>
            [
              quantifyToCPCPlus(color[0]),
              quantifyToCPCPlus(color[1]),
              quantifyToCPCPlus(color[2])
            ] as Vector<'RGB'>
        )
      : lockedVecs.map(
          (color) =>
            [
              quantizeCPC(color[0]),
              quantizeCPC(color[1]),
              quantizeCPC(color[2])
            ] as Vector<'RGB'>
        )

  const paletteStrategy = get(paletteStrategyAtom)
  // Read autoDistinctMapping to create dependency (triggers re-processing when toggle changes)
  const autoDistinctMapping = get(autoDistinctMappingAtom)

  logger.info('[Preview] Quantizing palette', {
    targetColors,
    paletteStrategy,
    autoDistinctMapping,
    hardware: cpcHardware
  })

  const palette = await paletteProcessor.quantizePalette(
    buf,
    sourceImage,
    targetColors,
    basePalette,
    quantifiedLockedVecs,
    paletteStrategy
  )

  return palette
})

// ============================================================================
// HARDWARE QUANTIZATION HELPERS
// ============================================================================

/**
 * Quantifies colors to CPC Classic 3-level format (0, 128, 255).
 * Skips colors that are already locked.
 */
function quantifyCPCClassicWithLocked(
  projected: Vector[],
  lockedColorKeys: Set<string>
): void {
  const quantifyToCPClassic = (value: number): number => {
    const levels = [0, 128, 255]
    let best = levels[0]
    let bestDist = Math.abs(value - best)

    for (const lvl of levels) {
      const dist = Math.abs(value - lvl)
      if (dist < bestDist) {
        bestDist = dist
        best = lvl
      }
    }
    return best
  }

  for (const color of projected) {
    const colorKey = `${color[0]},${color[1]},${color[2]}`

    // Skip quantification for locked colors
    if (lockedColorKeys.has(colorKey)) {
      continue
    }

    color[0] = quantifyToCPClassic(color[0])
    color[1] = quantifyToCPClassic(color[1])
    color[2] = quantifyToCPClassic(color[2])
  }
}

/**
 * Quantifies colors to CPC Plus 4-bit format.
 * Skips colors that are already locked.
 */
function quantifyCPCPlusWithLocked(
  projected: Vector[],
  lockedColorKeys: Set<string>
): void {
  for (const color of projected) {
    const colorKey = `${color[0]},${color[1]},${color[2]}`

    // Skip quantification for locked colors
    if (lockedColorKeys.has(colorKey)) {
      continue
    }

    color[0] = quantifyToCPCPlus(color[0])
    color[1] = quantifyToCPCPlus(color[1])
    color[2] = quantifyToCPCPlus(color[2])
  }
}

/**
 * RGB-quantized palette ready for display.
 * Colors are quantized according to CPC hardware (Classic: 27 colors, Plus: 4096 colors).
 */
export const reducedPaletteRgbAtom = atom(async (get) => {
  const cpcHardware = get(cpcHardwareAtom)
  const raw = await get(reducedPaletteRawAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const lockedEmptyCount = get(lockedEmptySlotsCountAtom)

  logger.info('[Preview] reducedPaletteRgbAtom', {
    rawLength: raw.length,
    modeNColors: modeConfig.nColors,
    lockedEmptyCount
  })

  // Colors are already in RGB format, no conversion needed
  const projected = [...raw] as Vector[] // Create a copy to avoid mutating original

  // Quantification according to selected hardware
  if (cpcHardware === 'classic') {
    quantifyCPCClassicWithLocked(projected, new Set())
  } else if (cpcHardware === 'plus') {
    quantifyCPCPlusWithLocked(projected, new Set())
  }

  // Ensure we never exceed the final limit
  // Account for locked empty slots to truncate palette
  const effectiveMaxColors = modeConfig.nColors - lockedEmptyCount
  if (projected.length > effectiveMaxColors) {
    projected.splice(effectiveMaxColors)
  }

  return projected
})
