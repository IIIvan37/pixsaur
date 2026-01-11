/**
 * Color Distance Calculations
 *
 * Single responsibility: Measuring perceptual distance between colors
 */

import { weightedRGBDistance } from '@/libs/pixsaur-color/src/metric/distance'
import type { Vector } from '@/libs/pixsaur-color/src/type'

// Default threshold for minimum perceptual distance to avoid visual duplicates
export const DEFAULT_PERCEPTUAL_THRESHOLD = 50

/**
 * Calculate perceptual distance between two RGB colors
 * Uses weighted RGB distance (accounts for human perception)
 *
 * @param a - First color vector
 * @param b - Second color vector
 * @returns Distance value (lower = more similar)
 */
export function perceptualDistance(a: Vector, b: Vector): number {
  return Math.sqrt(weightedRGBDistance(a, b))
}

/**
 * Check if two colors are perceptually similar
 *
 * @param a - First color
 * @param b - Second color
 * @param threshold - Maximum distance to be considered similar
 */
export function areColorsSimilar(
  a: Vector,
  b: Vector,
  threshold: number = DEFAULT_PERCEPTUAL_THRESHOLD
): boolean {
  return perceptualDistance(a, b) < threshold
}

/**
 * Check if a color is too close to any color in a reference set
 *
 * @param color - Color to check
 * @param referenceColors - Colors to compare against
 * @param threshold - Minimum distance threshold
 */
export function isColorTooClose(
  color: Vector,
  referenceColors: Vector[],
  threshold: number = DEFAULT_PERCEPTUAL_THRESHOLD
): boolean {
  return referenceColors.some(
    (ref) => perceptualDistance(color, ref) < threshold
  )
}
