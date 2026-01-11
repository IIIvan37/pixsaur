import type { Vector } from '../type'
import type { DistanceFn } from './distance'
import { euclideanDistance } from './distance'

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

/**
 * Simple squared Euclidean distance for RGB colors.
 * Optimized inline version for performance-critical code paths.
 *
 * @param a - First RGB color
 * @param b - Second RGB color
 * @returns Squared Euclidean distance (not square-rooted for performance)
 */
export function colorDistanceSquared(a: Vector, b: Vector): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

/**
 * Find the closest color in a palette subset (up to maxIndex inclusive).
 * Used for EGX and other modes with per-line palette constraints.
 *
 * @param target - The target color to match
 * @param palette - The full palette
 * @param maxIndex - Maximum index to search (inclusive)
 * @param distFn - Optional distance function (defaults to squared Euclidean)
 * @returns Object with index and color of closest match
 */
export function findClosestInSubset(
  target: Vector,
  palette: readonly Vector[],
  maxIndex: number,
  distFn: DistanceFn = euclideanDistance
): { index: number; color: Vector } {
  let bestIndex = 0
  let bestDist = Infinity

  const limit = Math.min(maxIndex + 1, palette.length)
  for (let i = 0; i < limit; i++) {
    const dist = distFn(target, palette[i])
    if (dist < bestDist) {
      bestDist = dist
      bestIndex = i
    }
  }

  return { index: bestIndex, color: palette[bestIndex] }
}
