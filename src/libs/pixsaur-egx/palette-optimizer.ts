/**
 * EGX Palette Optimizer
 *
 * Optimizes a palette for EGX mode with shared color constraints.
 *
 * The key challenge is that some colors must work for BOTH line types:
 * - EGX1: INK 0-3 shared between Mode 0 (16 colors) and Mode 1 (4 colors)
 * - EGX2: INK 0-1 shared between Mode 1 (4 colors) and Mode 2 (2 colors)
 *
 * Strategy:
 * 1. Use weighted histogram (same as GPU quantizer) for color importance
 * 2. Select shared colors that work well for both line types
 * 3. Fill remaining slots with colors for low-res mode only
 */

import { buildWeightedHistogram } from '@/libs/pixsaur-color/src/histogram'
import { getDistanceFn } from '@/libs/pixsaur-color/src/metric/distance'
import { selectTopIndicesCore } from '@/libs/pixsaur-color/src/quant/select-to-indices'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig, EGXPalette, EGXPaletteStats } from './types'
import { getSharedColorCount, getTotalPaletteSize } from './types'

// ============================================================================
// Hardware Palettes
// ============================================================================

/**
 * Generate CPC Classic palette (27 colors)
 */
function generateCPCClassicPalette(): Vector<'RGB'>[] {
  const levels = [0, 128, 255]
  const colors: Vector<'RGB'>[] = []
  for (const r of levels) {
    for (const g of levels) {
      for (const b of levels) {
        colors.push([r, g, b])
      }
    }
  }
  return colors
}

/**
 * Generate CPC Plus palette (4096 colors)
 */
function generateCPCPlusPalette(): Vector<'RGB'>[] {
  const colors: Vector<'RGB'>[] = []
  for (let r = 0; r < 16; r++) {
    for (let g = 0; g < 16; g++) {
      for (let b = 0; b < 16; b++) {
        colors.push([r * 17, g * 17, b * 17])
      }
    }
  }
  return colors
}

/**
 * Get hardware palette based on target
 */
export function getHardwarePalette(
  target: 'classic' | 'plus'
): Vector<'RGB'>[] {
  return target === 'classic'
    ? generateCPCClassicPalette()
    : generateCPCPlusPalette()
}

// ============================================================================
// Color Distance Utilities
// ============================================================================

const distFn = getDistanceFn('RGB', 'euclidean')

/**
 * Simple RGB color distance (squared euclidean)
 */
function colorDistance(a: Vector<'RGB'>, b: Vector<'RGB'>): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

/**
 * Find closest color in palette
 */
function findClosestColor(
  target: Vector<'RGB'>,
  palette: Vector<'RGB'>[]
): { color: Vector<'RGB'>; index: number; distance: number } {
  let bestIndex = 0
  let bestDistance = Infinity

  for (let i = 0; i < palette.length; i++) {
    const dist = colorDistance(target, palette[i])
    if (dist < bestDistance) {
      bestDistance = dist
      bestIndex = i
    }
  }

  return {
    color: palette[bestIndex],
    index: bestIndex,
    distance: bestDistance
  }
}

// ============================================================================
// Line-based Color Extraction
// ============================================================================

/**
 * Extract colors from image as vectors, separated by line type
 */
function extractColorsByLineType(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  _config: EGXConfig
): { evenLineColors: Vector<'RGB'>[]; oddLineColors: Vector<'RGB'>[] } {
  const evenLineColors: Vector<'RGB'>[] = []
  const oddLineColors: Vector<'RGB'>[] = []

  for (let y = 0; y < height; y++) {
    const isEvenLine = y % 2 === 0
    const targetArray = isEvenLine ? evenLineColors : oddLineColors

    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4
      const color: Vector<'RGB'> = [
        imageData[pixelIdx],
        imageData[pixelIdx + 1],
        imageData[pixelIdx + 2]
      ]
      targetArray.push(color)
    }
  }

  return { evenLineColors, oddLineColors }
}

// ============================================================================
// Histogram-based Palette Selection
// ============================================================================

/**
 * Build weighted histogram for a set of colors against hardware palette
 */
function buildHistogramForColors(
  colors: Vector<'RGB'>[],
  hardwarePalette: Vector<'RGB'>[]
): Float64Array {
  if (colors.length === 0) {
    return new Float64Array(hardwarePalette.length)
  }

  const histogram = buildWeightedHistogram(colors, hardwarePalette, distFn)
  return new Float64Array(histogram)
}

/**
 * Select all palette colors using combined histogram from both line types
 */
function selectAllColorsWithHistogram(
  lowResHistogram: Float64Array,
  highResHistogram: Float64Array,
  totalCount: number,
  hardwarePalette: Vector<'RGB'>[]
): { indices: number[]; colors: Vector<'RGB'>[] } {
  // Combine histograms equally for global color selection
  const combinedHistogram = new Uint32Array(hardwarePalette.length)

  for (let i = 0; i < hardwarePalette.length; i++) {
    const combined = lowResHistogram[i] + highResHistogram[i]
    combinedHistogram[i] = Math.round(combined * 10000)
  }

  // Calculate relative threshold (0.1% of total)
  const totalWeight = combinedHistogram.reduce((sum, v) => sum + v, 0)
  const relativeThreshold = Math.max(1, Math.floor(totalWeight * 0.001))

  // Use diversityMode for better color spread
  const indices = selectTopIndicesCore(combinedHistogram, [], totalCount, {
    threshold: relativeThreshold,
    diversityMode: true,
    basePalette: hardwarePalette
  })

  const colors = indices.map((i) => hardwarePalette[i])

  return { indices, colors }
}

/**
 * Reorder palette so that the best colors for high-res lines are in INK 0-3
 *
 * Given the 16 selected colors, find which 4 are most important for high-res
 * lines and move them to the first 4 positions.
 */
function reorderPaletteForHighRes(
  allColors: Vector<'RGB'>[],
  allIndices: number[],
  highResHistogram: Float64Array,
  sharedCount: number
): Vector<'RGB'>[] {
  if (allColors.length <= sharedCount) {
    return allColors
  }

  // Score each selected color by its importance in high-res lines
  const colorScores = allIndices.map((hwIndex, paletteIndex) => ({
    paletteIndex,
    hwIndex,
    color: allColors[paletteIndex],
    score: highResHistogram[hwIndex]
  }))

  // Sort by high-res score descending
  colorScores.sort((a, b) => b.score - a.score)

  // Take top sharedCount colors for INK 0-3 (or 0-1 for EGX2)
  const sharedColors = colorScores.slice(0, sharedCount).map((c) => c.color)
  const sharedSet = new Set(
    colorScores.slice(0, sharedCount).map((c) => c.paletteIndex)
  )

  // Rest of the colors keep their relative order from original selection
  const exclusiveColors = allColors.filter((_, i) => !sharedSet.has(i))

  return [...sharedColors, ...exclusiveColors]
}

// ============================================================================
// Main Optimization Function
// ============================================================================

/**
 * Optimize palette for EGX mode using histogram-based selection
 *
 * Strategy:
 * 1. Select all 16 (EGX1) or 4 (EGX2) best colors globally
 * 2. Reorder so the most important colors for high-res lines are in INK 0-3 (or 0-1)
 *
 * This ensures we get the best overall palette, then optimize the shared slots
 * for the high-res lines which are more constrained.
 *
 * @param imageData - Source image RGBA data
 * @param width - Image width
 * @param height - Image height
 * @param config - EGX configuration
 * @returns Optimized EGX palette
 */
export function optimizeEGXPalette(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  config: EGXConfig
): EGXPalette {
  const hardwarePalette = getHardwarePalette(config.targetHardware)
  const sharedCount = getSharedColorCount(config.type)
  const totalCount = getTotalPaletteSize(config.type)

  // Extract colors by line type
  const { evenLineColors, oddLineColors } = extractColorsByLineType(
    imageData,
    width,
    height,
    config
  )

  // Determine which lines use which mode based on firstLineMode
  const lowResColors =
    config.firstLineMode === 'low' ? evenLineColors : oddLineColors
  const highResColors =
    config.firstLineMode === 'low' ? oddLineColors : evenLineColors

  // Build histograms using same method as GPU quantizer
  const lowResHistogram = buildHistogramForColors(lowResColors, hardwarePalette)
  const highResHistogram = buildHistogramForColors(
    highResColors,
    hardwarePalette
  )

  // Step 1: Select all colors globally (best 16 for EGX1, best 4 for EGX2)
  const { indices: allIndices, colors: allColors } =
    selectAllColorsWithHistogram(
      lowResHistogram,
      highResHistogram,
      totalCount,
      hardwarePalette
    )

  // Step 2: Reorder palette so best high-res colors are in INK 0-3 (or 0-1)
  const colors = reorderPaletteForHighRes(
    allColors,
    allIndices,
    highResHistogram,
    sharedCount
  )

  // Compute stats
  const stats = computePaletteStats(
    imageData,
    width,
    height,
    colors,
    sharedCount,
    config
  )

  return {
    colors,
    sharedColorCount: sharedCount,
    stats
  }
}

/**
 * Compute palette statistics
 */
function computePaletteStats(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Vector<'RGB'>[],
  sharedCount: number,
  config: EGXConfig
): EGXPaletteStats {
  let lowModeError = 0
  let highModeError = 0
  let lowModePixels = 0
  let highModePixels = 0

  const lowModeColors = new Set<number>()
  const highModeColors = new Set<number>()

  for (let y = 0; y < height; y++) {
    const isEvenLine = y % 2 === 0
    const isLowMode =
      (config.firstLineMode === 'low' && isEvenLine) ||
      (config.firstLineMode === 'high' && !isEvenLine)

    // High-res lines can only use shared colors
    const availablePalette = isLowMode ? palette : palette.slice(0, sharedCount)
    const colorSet = isLowMode ? lowModeColors : highModeColors

    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4
      const color: Vector<'RGB'> = [
        imageData[pixelIdx],
        imageData[pixelIdx + 1],
        imageData[pixelIdx + 2]
      ]

      const { index, distance } = findClosestColor(color, availablePalette)
      colorSet.add(index)

      if (isLowMode) {
        lowModeError += distance
        lowModePixels++
      } else {
        highModeError += distance
        highModePixels++
      }
    }
  }

  return {
    colorsUsedLowMode: lowModeColors.size,
    colorsUsedHighMode: highModeColors.size,
    avgErrorLowMode: lowModePixels > 0 ? lowModeError / lowModePixels : 0,
    avgErrorHighMode: highModePixels > 0 ? highModeError / highModePixels : 0,
    totalError: lowModeError + highModeError
  }
}
