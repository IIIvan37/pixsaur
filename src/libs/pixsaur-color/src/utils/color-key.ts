/**
 * Color key utilities
 * Generic string-key encoding of RGB colors for Set/Map lookups
 */

import type { Vector } from '../type'

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
 * Create a Set of color keys for fast lookup
 */
export function createColorKeySet(colors: Vector[]): Set<string> {
  return new Set(colors.map(colorToKey))
}
