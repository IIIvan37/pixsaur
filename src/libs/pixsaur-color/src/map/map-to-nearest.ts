import { DistanceFn } from '../metric/distance'
import { Vector } from '../type'

/**
 * Maps a color to the nearest color in a given palette using a specified distance function.
 *
 * @param {Vector} color - The color to map.
 * @param {Vector[]} palette - The palette of colors to map to.
 * @param {DistanceFn} dist - The distance function to use for comparison.
 * @returns {Vector} - The nearest color from the palette.
 * @throws {Error} - If the palette is empty.
 */
export function mapToNearest(
  color: Vector,
  palette: Vector[],
  dist: DistanceFn
): Vector {
  if (palette.length === 0) throw new Error('Palette cannot be empty')

  let nearest = palette[0]
  let bestDist = dist(color, nearest)

  for (let i = 1; i < palette.length; i++) {
    const c = palette[i]
    const d = dist(color, c)
    if (d < bestDist) {
      bestDist = d
      nearest = c
    }
  }

  return nearest
}
