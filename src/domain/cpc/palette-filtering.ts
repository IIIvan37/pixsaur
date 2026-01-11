/**
 * Palette Filtering
 *
 * Single responsibility: Filtering palettes based on various criteria
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import { DEFAULT_PERCEPTUAL_THRESHOLD, isColorTooClose } from './color-distance'

/**
 * Filter colors that are too close to reference colors
 *
 * @param palette - Palette to filter
 * @param referenceColors - Reference colors to compare against
 * @param threshold - Minimum distance threshold
 * @returns Filtered palette without colors too close to reference
 */
export function filterByDistance(
  palette: Vector[],
  referenceColors: Vector[],
  threshold: number = DEFAULT_PERCEPTUAL_THRESHOLD
): Vector[] {
  if (referenceColors.length === 0) return palette
  return palette.filter(
    (color) => !isColorTooClose(color, referenceColors, threshold)
  )
}

/**
 * Filter out ignored slots from a palette
 *
 * @param palette - Palette that may contain ignored markers
 * @param ignoredMarker - The marker value for ignored slots (default: [-1,-1,-1])
 */
export function filterIgnored(
  palette: Vector[],
  ignoredMarker: Vector = [-1, -1, -1]
): Vector[] {
  return palette.filter(
    (c) =>
      c[0] !== ignoredMarker[0] ||
      c[1] !== ignoredMarker[1] ||
      c[2] !== ignoredMarker[2]
  )
}

/**
 * Truncate palette to maximum number of colors
 */
export function truncatePalette(
  palette: Vector[],
  maxColors: number
): Vector[] {
  return palette.slice(0, maxColors)
}
