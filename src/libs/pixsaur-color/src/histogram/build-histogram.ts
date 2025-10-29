import { quantizerLogger } from '../../../../utils/logger'
import { mapToNearest } from '../map/map-to-nearest'
import type { DistanceFn } from '../metric/distance'
import type { Vector } from '../type'

// Helper functions for debugging CPC colors
const CPC_COLOR_NAMES: Record<string, string> = {
  '0,0,128': 'Blue',
  '0,0,255': 'Bright Blue',
  '0,128,255': 'Sky Blue',
  '128,128,255': 'Pastel Blue',
  '0,255,255': 'Bright Cyan',
  '128,255,255': 'Pastel Cyan',
  '255,0,0': 'Bright Red',
  '128,0,0': 'Red',
  '255,0,128': 'Purple',
  '128,0,128': 'Magenta',
  '255,0,255': 'Bright Magenta',
  '128,0,255': 'Mauve',
  '0,128,0': 'Green',
  '0,255,0': 'Bright Green',
  '128,255,0': 'Lime',
  '128,128,0': 'Yellow',
  '255,255,0': 'Bright Yellow',
  '255,128,0': 'Orange',
  '0,0,0': 'Black',
  '255,255,255': 'Bright White',
  '128,128,128': 'White'
}

function getCPCColorName(color: Vector): string {
  const key = color.join(',')
  return CPC_COLOR_NAMES[key] || `RGB(${color.join(',')})`
}

function isBlueColor(color: Vector): boolean {
  const [r, g, b] = color
  // Consider a color blue if blue component is dominant and > 100
  return b > 100 && b >= r && b >= g
}

/**
 * Builds a histogram of color frequencies by mapping each color in the input
 * to the nearest color in the palette.
 *
 * @param {Vector[]} input - The input colors to process.
 * @param {Vector[]} palette - The palette of colors to map to.
 * @param {DistanceFn} dist - The distance function to use for comparison.
 * @returns {number[]} - An array representing the frequency of each palette color.
 * @throws {Error} - If the palette is empty.
 */
export function buildHistogram(
  input: Vector[],
  palette: Vector[],
  dist: DistanceFn
): number[] {
  if (palette.length === 0) {
    throw new Error('Palette cannot be empty')
  }

  const histogram = new Array(palette.length).fill(0)

  // Map each input color to the nearest palette color and update the histogram
  for (const color of input) {
    const nearestColor = mapToNearest(color, palette, dist)
    const nearestIndex = palette.indexOf(nearestColor)
    histogram[nearestIndex]++
  }

  return histogram
}

/**
 * Builds a weighted histogram where pixel contribution depends on mapping quality.
 * Colors that map poorly to any palette color contribute less to avoid
 * over-representing suboptimal mappings.
 *
 * @param {Vector[]} input - The input colors to process.
 * @param {Vector[]} palette - The palette of colors to map to.
 * @param {DistanceFn} dist - The distance function to use for comparison.
 * @returns {number[]} - An array representing the weighted frequency of each palette color.
 * @throws {Error} - If the palette is empty.
 */
export function buildWeightedHistogram(
  input: Vector[],
  palette: Vector[],
  dist: DistanceFn
): number[] {
  if (palette.length === 0) {
    throw new Error('Palette cannot be empty')
  }

  const histogram = new Array(palette.length).fill(0)

  // Calculate distances to all palette colors for each input color
  for (const color of input) {
    let totalWeight = 0
    const weights = new Array(palette.length).fill(0)

    // Calculate weight for each palette color (inverse distance weighting)
    for (let i = 0; i < palette.length; i++) {
      const distance = dist(color, palette[i])
      if (distance === 0) {
        // Perfect match - all weight goes to this color
        weights[i] = 1
        totalWeight = 1
        break
      } else {
        // Weight = 1 / (distance + epsilon) - gives higher weight to closer colors
        const weight = 1 / (distance + 0.001) // epsilon to avoid division by zero
        weights[i] = weight
        totalWeight += weight
      }
    }

    // Normalize weights and add to histogram
    for (let i = 0; i < palette.length; i++) {
      histogram[i] += weights[i] / totalWeight
    }
  }

  // Log histogram analysis for debugging blue colors
  const histogramWithNames = palette
    .map((color, idx) => ({
      index: idx,
      color,
      weight: histogram[idx],
      name: getCPCColorName(color),
      isBlue: isBlueColor(color)
    }))
    .sort((a, b) => b.weight - a.weight)

  quantizerLogger.info('🎨 Weighted Histogram Analysis:')
  quantizerLogger.info(`Total pixels processed: ${input.length}`)
  quantizerLogger.info(
    'Top 10 colors by weight:',
    histogramWithNames.slice(0, 10)
  )
  quantizerLogger.info(
    'Blue colors in histogram:',
    histogramWithNames.filter((entry) => entry.isBlue)
  )

  return histogram
}
