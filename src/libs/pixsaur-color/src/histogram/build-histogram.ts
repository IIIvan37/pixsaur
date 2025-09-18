import { mapToNearest } from '../map/map-to-nearest'
import type { DistanceFn } from '../metric/distance'
import type { Vector } from '../type'

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

  // DEBUG: Log de la palette utilisée par le CPU
  console.log('📊 [CPU DEBUG] Palette utilisée par buildHistogram:')
  palette.forEach((color, index) => {
    const [r, g, b] = Array.from(color)
    console.log(`  ${index}: RGB(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`)
  })

  // Map each input color to the nearest palette color and update the histogram
  for (const color of input) {
    const nearestColor = mapToNearest(color, palette, dist)
    const nearestIndex = palette.indexOf(nearestColor)
    histogram[nearestIndex]++
  }

  // DEBUG: Log de l'histogramme résultant
  console.log('📊 [CPU DEBUG] Histogramme résultant:')
  const totalPixels = histogram.reduce((sum, count) => sum + count, 0)
  const sortedIndices = histogram
    .map((count, index) => ({ index, count, color: palette[index] }))
    .sort((a, b) => b.count - a.count)
  
  console.log('🔝 Top 10 most frequent colors (CPU DEBUG):')
  sortedIndices.slice(0, 10).forEach((entry, rank) => {
    if (entry.count > 0) {
      const [r, g, b] = Array.from(entry.color)
      console.log(`  ${rank + 1}. RGB(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}) - ${entry.count} pixels (${(entry.count / totalPixels * 100).toFixed(1)}%)`)
    }
  })

  // Histogram computation completed

  return histogram
}
