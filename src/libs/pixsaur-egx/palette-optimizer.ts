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
 * 1. Analyze colors needed by each line type separately
 * 2. Find shared colors that work well for both
 * 3. Fill remaining slots with colors for low-res mode only
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig, EGXPalette, EGXPaletteStats } from './types'
import { getSharedColorCount, getTotalPaletteSize } from './types'

// ============================================================================
// Color Analysis Types
// ============================================================================

interface ColorFrequency {
  color: Vector<'RGB'>
  count: number
  /** Palette index in hardware palette */
  paletteIndex: number
}

interface LineAnalysis {
  /** Colors found in even lines (first line type) */
  evenLineColors: ColorFrequency[]
  /** Colors found in odd lines (second line type) */
  oddLineColors: ColorFrequency[]
}

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
// Color Distance
// ============================================================================

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
// Line Analysis
// ============================================================================

/**
 * Analyze colors in image, separating by line parity
 */
function analyzeImageByLines(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  hardwarePalette: Vector<'RGB'>[]
): LineAnalysis {
  const evenCounts = new Map<number, number>()
  const oddCounts = new Map<number, number>()

  for (let y = 0; y < height; y++) {
    const isEvenLine = y % 2 === 0
    const counts = isEvenLine ? evenCounts : oddCounts

    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4
      const color: Vector<'RGB'> = [
        imageData[pixelIdx],
        imageData[pixelIdx + 1],
        imageData[pixelIdx + 2]
      ]

      const { index } = findClosestColor(color, hardwarePalette)
      counts.set(index, (counts.get(index) || 0) + 1)
    }
  }

  // Convert to sorted arrays
  const toColorFrequency = (counts: Map<number, number>): ColorFrequency[] => {
    return Array.from(counts.entries())
      .map(([index, count]) => ({
        color: hardwarePalette[index],
        count,
        paletteIndex: index
      }))
      .sort((a, b) => b.count - a.count)
  }

  return {
    evenLineColors: toColorFrequency(evenCounts),
    oddLineColors: toColorFrequency(oddCounts)
  }
}

// ============================================================================
// Palette Optimization
// ============================================================================

/**
 * Select shared colors that work well for both line types
 *
 * These colors will be used by BOTH modes, so they need to
 * represent important colors from both line types.
 */
function selectSharedColors(
  evenColors: ColorFrequency[],
  oddColors: ColorFrequency[],
  count: number,
  hardwarePalette: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  // Score each palette color based on usage in both line types
  const scores = new Map<number, number>()

  // Weight for high-res lines (they're more constrained)
  const HIGH_RES_WEIGHT = 2

  for (const { paletteIndex, count } of evenColors) {
    scores.set(paletteIndex, (scores.get(paletteIndex) || 0) + count)
  }

  for (const { paletteIndex, count } of oddColors) {
    scores.set(
      paletteIndex,
      (scores.get(paletteIndex) || 0) + count * HIGH_RES_WEIGHT
    )
  }

  // Sort by combined score
  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([index]) => hardwarePalette[index])

  // Take top colors, ensuring diversity
  const selected: Vector<'RGB'>[] = []
  const MIN_DISTANCE = 1000 // Minimum distance between selected colors

  for (const color of sorted) {
    if (selected.length >= count) break

    // Check diversity
    const isDiverse = selected.every(
      (existing) => colorDistance(color, existing) >= MIN_DISTANCE
    )

    if (isDiverse || selected.length < 2) {
      selected.push(color)
    }
  }

  // Fill remaining if needed (relaxed diversity)
  for (const color of sorted) {
    if (selected.length >= count) break
    if (!selected.some((c) => colorDistance(c, color) < 100)) {
      selected.push(color)
    }
  }

  return selected.slice(0, count)
}

/**
 * Select exclusive colors for low-res mode only
 */
function selectExclusiveColors(
  lowResColors: ColorFrequency[],
  sharedColors: Vector<'RGB'>[],
  count: number,
  hardwarePalette: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  const selected: Vector<'RGB'>[] = []
  const usedIndices = new Set<number>()

  // Mark shared colors as used
  for (const shared of sharedColors) {
    const { index } = findClosestColor(shared, hardwarePalette)
    usedIndices.add(index)
  }

  // Add most frequent colors not already used
  for (const { paletteIndex } of lowResColors) {
    if (selected.length >= count) break
    if (!usedIndices.has(paletteIndex)) {
      selected.push(hardwarePalette[paletteIndex])
      usedIndices.add(paletteIndex)
    }
  }

  return selected
}

// ============================================================================
// Main Optimization Function
// ============================================================================

/**
 * Optimize palette for EGX mode
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

  // Analyze image by line parity
  const analysis = analyzeImageByLines(
    imageData,
    width,
    height,
    hardwarePalette
  )

  // Determine which lines use which mode based on firstLineMode
  // 'low' = even lines use low-res mode (Mode 0 for EGX1)
  // 'high' = even lines use high-res mode (Mode 1 for EGX1)
  const lowResColors =
    config.firstLineMode === 'low'
      ? analysis.evenLineColors
      : analysis.oddLineColors
  const highResColors =
    config.firstLineMode === 'low'
      ? analysis.oddLineColors
      : analysis.evenLineColors

  // Select shared colors (must work for both modes)
  const sharedColors = selectSharedColors(
    lowResColors,
    highResColors,
    sharedCount,
    hardwarePalette
  )

  // Select exclusive colors (only for low-res mode)
  const exclusiveCount = totalCount - sharedCount
  const exclusiveColors = selectExclusiveColors(
    lowResColors,
    sharedColors,
    exclusiveCount,
    hardwarePalette
  )

  // Combine: shared colors first (INK 0-3 or 0-1), then exclusive
  const colors = [...sharedColors, ...exclusiveColors]

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
