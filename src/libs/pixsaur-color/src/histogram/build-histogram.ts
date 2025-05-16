import { mapToNearest } from '../map/map-to-nearest'
import { DistanceFn } from '../metric/distance'
import { Vector } from '../type'

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
