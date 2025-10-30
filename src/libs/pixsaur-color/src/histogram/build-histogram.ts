
import type { DistanceFn } from '../metric/distance'
import type { Vector } from '../type'



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

  return histogram
}
