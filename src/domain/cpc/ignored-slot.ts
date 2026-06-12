/**
 * Ignored Slot Marker
 *
 * Single responsibility: Handling the special "ignored" slot marker
 * used during export to indicate slots that should be skipped
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import { findDarkestInPalette } from '@/libs/pixsaur-color/src/utils/luminance'

/**
 * Marker for ignored slots in export palette
 * Used to indicate slots that should not be used during export
 */
export const IGNORED_SLOT: Vector = [-1, -1, -1]

/**
 * Check if a color vector represents an ignored slot
 */
export function isIgnoredSlot(color: Vector): boolean {
  return color[0] === -1 && color[1] === -1 && color[2] === -1
}

/**
 * Replace ignored slots in a palette with a replacement color
 *
 * @param palette - Palette that may contain IGNORED_SLOT markers
 * @param replacement - Color to use for ignored slots
 * @returns New palette with ignored slots replaced
 */
export function replaceIgnoredSlots(
  palette: Vector[],
  replacement: Vector
): Vector[] {
  return palette.map((color) => (isIgnoredSlot(color) ? replacement : color))
}

/**
 * Find the darkest valid color in a palette
 * Filters out ignored slots [-1,-1,-1] before comparison
 *
 * @param palette - Array of color vectors (may include IGNORED_SLOT)
 * @param fallback - Fallback color if no valid colors found (default: black)
 * @returns Darkest valid color or fallback
 */
export function findDarkestValidColor(
  palette: Vector[],
  fallback: Vector = [0, 0, 0]
): Vector {
  const validColors = palette.filter((c) => !isIgnoredSlot(c))
  return findDarkestInPalette(validColors, fallback)
}
