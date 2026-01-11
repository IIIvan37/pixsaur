/**
 * EGX Palette Reordering
 *
 * Functions for analyzing and reordering palettes based on
 * high-resolution line color usage in EGX mode.
 */

import { colorDistanceSquared } from '../pixsaur-color/src/metric/find-closest'
import type { Vector } from '../pixsaur-color/src/type'
import type { EGXConfig } from './types'

// ============================================================================
// Utility Generators
// ============================================================================

/**
 * Generate all combinations of k elements from arr
 */
export function* combinations(arr: number[], k: number): Generator<number[]> {
  const n = arr.length
  if (k > n) return
  const indices = Array.from({ length: k }, (_, i) => i)
  while (true) {
    yield indices.map((i) => arr[i])
    let i = k - 1
    while (i >= 0 && indices[i] === n - k + i) i--
    if (i < 0) break
    indices[i]++
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1
  }
}

// ============================================================================
// Palette Analysis
// ============================================================================

/**
 * Analyze color usage on high-resolution lines to determine
 * which colors should be in the shared slots (INK 0-3 for EGX1, INK 0-1 for EGX2)
 */
export function analyzeHighResLineColors(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig
): Map<number, number> {
  const colorUsage = new Map<number, number>()
  const { width, height } = imageData
  const data = imageData.data

  // Initialize usage counts
  for (let i = 0; i < palette.length; i++) {
    colorUsage.set(i, 0)
  }

  // Analyze only high-resolution lines
  for (let y = 0; y < height; y++) {
    const isHighResLine =
      (config.firstLineMode === 'low' && y % 2 !== 0) ||
      (config.firstLineMode === 'high' && y % 2 === 0)

    if (!isHighResLine) continue

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const pixel: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]

      // Find closest color in palette
      let bestIndex = 0
      let bestDist = Infinity
      for (let i = 0; i < palette.length; i++) {
        const dist = colorDistanceSquared(pixel, palette[i])
        if (dist < bestDist) {
          bestDist = dist
          bestIndex = i
        }
      }

      colorUsage.set(bestIndex, (colorUsage.get(bestIndex) ?? 0) + 1)
    }
  }

  return colorUsage
}

// ============================================================================
// Color Distance Helpers
// ============================================================================

/**
 * Calculate perceived luminance (standard formula)
 */
function getLuminance(c: Vector<'RGB'>): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

/**
 * Check if two colors are perceptually too close (only for CPC Plus)
 */
function areTooClose(
  c1: Vector<'RGB'>,
  c2: Vector<'RGB'>,
  isPlus: boolean,
  minDistanceSq: number,
  minLuminanceDiff: number
): boolean {
  if (!isPlus) return false // No constraint for Classic

  const distSq = colorDistanceSquared(c1, c2)
  if (distSq >= minDistanceSq) return false

  // For dark colors, also require luminance difference
  const lum1 = getLuminance(c1)
  const lum2 = getLuminance(c2)
  if (lum1 < 80 && lum2 < 80) {
    // Both are dark: check luminance difference
    return Math.abs(lum1 - lum2) < minLuminanceDiff
  }
  return true
}

// ============================================================================
// Palette Reordering
// ============================================================================

/**
 * Find the best combination of colors for shared slots
 */
function findBestCombination(
  topIndices: number[],
  sharedCount: number,
  palette: Vector<'RGB'>[],
  colorUsage: Map<number, number>,
  isPlus: boolean
): number[] {
  const MIN_DISTANCE_SQ = isPlus ? 100 * 100 : 0 // Minimum 100 RGB units for Plus
  const MIN_LUMINANCE_DIFF = 40 // Minimum luminance difference for dark colors

  let bestScore = -Infinity
  let bestCombo: number[] = []

  for (const combo of combinations(topIndices, sharedCount)) {
    // Check minimum distance constraint
    let valid = true
    for (let i = 0; i < combo.length && valid; i++) {
      for (let j = i + 1; j < combo.length && valid; j++) {
        if (
          areTooClose(
            palette[combo[i]],
            palette[combo[j]],
            isPlus,
            MIN_DISTANCE_SQ,
            MIN_LUMINANCE_DIFF
          )
        ) {
          valid = false
        }
      }
    }
    if (!valid) continue

    // Score = 0.7*coverage + 0.3*contrast
    let coverage = 0
    for (const idx of combo) coverage += colorUsage.get(idx) ?? 0

    let contrast = 0
    let pairs = 0
    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        contrast += colorDistanceSquared(palette[combo[i]], palette[combo[j]])
        pairs++
      }
    }
    contrast = pairs > 0 ? contrast / pairs : 0

    const score = 0.7 * coverage + 0.3 * contrast
    if (score > bestScore) {
      bestScore = score
      bestCombo = combo
    }
  }

  return bestCombo
}

/**
 * Fallback selection when no valid combination is found
 */
function selectFallbackColors(
  topIndices: number[],
  sharedCount: number,
  palette: Vector<'RGB'>[],
  isPlus: boolean
): number[] {
  const MIN_DISTANCE_SQ = isPlus ? 100 * 100 : 0
  const MIN_LUMINANCE_DIFF = 40
  const selected: number[] = []

  // Select most used colors while respecting minimum distance
  for (const idx of topIndices) {
    if (selected.length >= sharedCount) break
    const candidate = palette[idx]
    const isTooClose = selected.some((selectedIdx) =>
      areTooClose(
        candidate,
        palette[selectedIdx],
        isPlus,
        MIN_DISTANCE_SQ,
        MIN_LUMINANCE_DIFF
      )
    )
    if (!isTooClose) {
      selected.push(idx)
    }
  }

  // If still not enough, fill with remaining most used
  for (const idx of topIndices) {
    if (selected.length >= sharedCount) break
    if (!selected.includes(idx)) {
      selected.push(idx)
    }
  }

  return selected
}

/**
 * Reorder palette so that the most used colors on high-res lines
 * are in the shared slots (first N positions).
 *
 * Also ensures color diversity: if two selected colors are too similar,
 * the second one is replaced by the next most-used distinct color.
 */
export function optimizePaletteForEGX(
  palette: Vector<'RGB'>[],
  colorUsage: Map<number, number>,
  sharedCount: number,
  isPlus: boolean = false
): Vector<'RGB'>[] {
  // Sort color indices by usage (descending)
  const sortedIndices = [...colorUsage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx]) => idx)

  // Test all combinations of the 8 most used colors for shared slots
  const topIndices = sortedIndices.slice(0, Math.max(8, sharedCount))

  // Find best combination
  let bestCombo = findBestCombination(
    topIndices,
    sharedCount,
    palette,
    colorUsage,
    isPlus
  )

  // Fallback if no valid combination found
  if (bestCombo.length === 0) {
    bestCombo = selectFallbackColors(topIndices, sharedCount, palette, isPlus)
  }

  // Build remaining indices (colors not selected for shared slots)
  const remainingIndices = sortedIndices.filter(
    (idx) => !bestCombo.includes(idx)
  )

  // Build optimized palette
  const optimized: Vector<'RGB'>[] = []

  // First: shared colors (best combination)
  for (const idx of bestCombo) {
    optimized.push(palette[idx])
  }

  // Then: remaining colors
  for (const idx of remainingIndices) {
    optimized.push(palette[idx])
  }

  // Pad with black if needed
  while (optimized.length < palette.length) {
    optimized.push([0, 0, 0])
  }

  return optimized
}
