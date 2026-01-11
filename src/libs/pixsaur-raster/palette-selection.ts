/**
 * Palette Selection
 *
 * Functions for selecting optimal palettes from color histograms.
 * Implements Farthest Point Sampling for maximum color diversity.
 */

import { weightedRGBDistance } from '../pixsaur-color/src/metric/distance'
import type { Vector } from '../pixsaur-color/src/type'
import { rasterTuningOverrides } from './raster-tuning'

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Convert color to string key for Set/Map operations
 */
export function colorKey(color: Vector<'RGB'>): string {
  return `${color[0]},${color[1]},${color[2]}`
}

/**
 * Check if two colors are equal
 */
export function colorsEqual(a: Vector<'RGB'>, b: Vector<'RGB'>): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

// ============================================================================
// Color Frequency Types
// ============================================================================

export interface ColorFrequency {
  color: Vector<'RGB'>
  count: number
}

// ============================================================================
// Farthest Point Sampling
// ============================================================================

/**
 * Select palette using "Farthest Point Sampling" algorithm.
 * This maximizes the distance between chosen colors, preserving extremes.
 *
 * Algorithm from raster-ideas.md §5.1.1:
 * 1. Start with the most frequent color
 * 2. Add colors that maximize minimum distance to already-selected colors
 *
 * @param colorFrequencies - Map of colors to their frequencies
 * @param maxColors - Maximum colors to select (4)
 * @param previousPalette - Previous line's palette for continuity bonus
 * @returns Selected colors
 */
export function selectPaletteFarthestPoint(
  colorFrequencies: Map<string, ColorFrequency>,
  maxColors: number,
  previousPalette: Vector<'RGB'>[] | null = null
): Vector<'RGB'>[] {
  // Use preprocessing parameters for base palette extraction
  const continuityDistance = rasterTuningOverrides.preprocessContinuityDistance
  const continuityBonusValue = rasterTuningOverrides.preprocessContinuityBonus
  const frequencyExponent = rasterTuningOverrides.preprocessFrequencyExponent

  const colors = Array.from(colorFrequencies.values())

  if (colors.length === 0) {
    return previousPalette
      ? [...previousPalette]
      : [
          [0, 0, 0],
          [85, 85, 85],
          [170, 170, 170],
          [255, 255, 255]
        ]
  }

  if (colors.length <= maxColors) {
    return colors.map((c) => c.color)
  }

  // Sort by frequency
  colors.sort((a, b) => b.count - a.count)

  const palette: Vector<'RGB'>[] = []
  const usedKeys = new Set<string>()

  // Start with the most frequent color
  const first = colors[0]
  palette.push(first.color)
  usedKeys.add(colorKey(first.color))

  // Add remaining colors using farthest point sampling
  while (palette.length < maxColors && colors.length > palette.length) {
    let bestColor: Vector<'RGB'> | null = null
    let bestScore = -1

    for (const { color, count } of colors) {
      const key = colorKey(color)
      if (usedKeys.has(key)) continue

      // Calculate minimum distance to all already-selected colors
      let minDist = Number.POSITIVE_INFINITY
      for (const palColor of palette) {
        const dist = weightedRGBDistance(color, palColor)
        if (dist < minDist) {
          minDist = dist
        }
      }

      // Score = distance * (frequency ^ exponent) to balance distance and importance
      // High frequency colors that are far from selected colors are preferred
      // Exponent controls frequency influence: 0.5 = sqrt (balanced), 1.0 = linear (strong)
      const frequencyWeight = count ** frequencyExponent
      const score = minDist * frequencyWeight

      // Bonus for colors similar to previous palette (continuity)
      let continuityBonusFactor = 1
      if (previousPalette) {
        for (const prevColor of previousPalette) {
          const dist = weightedRGBDistance(color, prevColor)
          if (dist < continuityDistance) {
            continuityBonusFactor = continuityBonusValue
            break
          }
        }
      }

      const finalScore = score * continuityBonusFactor

      if (finalScore > bestScore) {
        bestScore = finalScore
        bestColor = color
      }
    }

    if (!bestColor) break

    palette.push(bestColor)
    usedKeys.add(colorKey(bestColor))
  }

  return palette
}

// ============================================================================
// Line Color Extraction
// ============================================================================

/**
 * Extract all unique colors from a single line with their frequencies.
 */
export function extractLineColorFrequencies(
  sourceImage: ImageData,
  line: number
): Map<string, ColorFrequency> {
  const { width, data } = sourceImage
  const lineStart = line * width * 4

  const colorFrequency = new Map<string, ColorFrequency>()

  for (let x = 0; x < width; x++) {
    const idx = lineStart + x * 4
    const color: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]
    const key = colorKey(color)

    const existing = colorFrequency.get(key)
    if (existing) {
      existing.count++
    } else {
      colorFrequency.set(key, { color, count: 1 })
    }
  }

  return colorFrequency
}

// ============================================================================
// Best Colors Selection
// ============================================================================

/**
 * Select the best colors for a line based on color frequencies
 *
 * Since preprocessImageForRaster always reduces each line to exactly 4 colors
 * via Floyd-Steinberg dithering + Farthest Point Sampling, this function
 * always returns immediately with the line colors.
 */
export function selectBestColorsForLine(
  colorFrequencies: Map<string, ColorFrequency>,
  _currentPalette: Vector<'RGB'>[],
  _basePalette: Vector<'RGB'>[] | null = null,
  maxColors: number = 4,
  _cpcClassicPalette?: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  // preprocessImageForRaster guarantees colorFrequencies.size <= maxColors (always 4)
  // So this always executes and returns immediately
  if (colorFrequencies.size <= maxColors) {
    return Array.from(colorFrequencies.values()).map((v) => v.color)
  }

  // Dead code: never reached because preprocessing guarantees ≤4 colors per line
  throw new Error(
    'selectBestColorsForLine: Unexpected >4 colors per line. ' +
      'This indicates preprocessImageForRaster is not reducing to 4 colors.'
  )
}
