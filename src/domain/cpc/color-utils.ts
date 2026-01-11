/**
 * Color Utilities
 *
 * Single responsibility: Generic color vector operations
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import { luminance } from '@/libs/pixsaur-color/src/utils/luminance'
import { isIgnoredSlot } from './ignored-slot'

// Re-export findDarkestColor from pixsaur-color
export { findDarkestColor } from '@/libs/pixsaur-color/src/utils/luminance'

/**
 * Build a color key string from RGB components
 * Used for Set/Map lookups
 */
export function colorToKey(color: Vector): string {
  return `${color[0]},${color[1]},${color[2]}`
}

/**
 * Parse a color key string back to RGB components
 */
export function keyToColor(key: string): Vector {
  const [r, g, b] = key.split(',').map(Number)
  return [r, g, b]
}

/**
 * Find the darkest color in a palette using luminance
 *
 * @param palette - Array of color vectors
 * @param fallback - Fallback color if palette is empty (default: black)
 * @returns Darkest color or fallback
 */
export function findDarkestInPalette(
  palette: Vector[],
  fallback: Vector = [0, 0, 0]
): Vector {
  if (palette.length === 0) return fallback

  return palette.reduce((darkest, color) => {
    return luminance(color) < luminance(darkest) ? color : darkest
  }, palette[0])
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

/**
 * Create a Set of color keys for fast lookup
 */
export function createColorKeySet(colors: Vector[]): Set<string> {
  return new Set(colors.map(colorToKey))
}
