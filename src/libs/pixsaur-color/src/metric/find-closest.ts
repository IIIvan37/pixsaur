import type { Vector } from '../type'
import type { DistanceFn } from './distance'

/**
 * Finds the index of the closest color in a palette to the given color.
 * Uses a specified distance function for comparison.
 *
 * @param color - The color to match
 * @param palette - The palette of colors to search
 * @param distFn - The distance function to use for comparison
 * @returns The index of the closest color in the palette
 * @throws {Error} If the palette is empty
 *
 * @example
 * ```ts
 * import { findClosestColorIndex } from '@/libs/pixsaur-color/src/metric/find-closest'
 * import { weightedRGBDistance } from '@/libs/pixsaur-color/src/metric/distance'
 *
 * const color: Vector = [128, 64, 200]
 * const palette: Vector[] = [[255, 0, 0], [0, 255, 0], [0, 0, 255]]
 * const index = findClosestColorIndex(color, palette, weightedRGBDistance)
 * ```
 */
export function findClosestColorIndex(
  color: Vector | Float32Array,
  palette: readonly Vector[] | readonly Float32Array[],
  distFn: DistanceFn
): number {
  if (palette.length === 0) {
    throw new Error('Palette cannot be empty')
  }

  let bestIndex = 0
  let bestDistance = distFn(color, palette[0])

  for (let i = 1; i < palette.length; i++) {
    const distance = distFn(color, palette[i])
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = i
    }
  }

  return bestIndex
}
