/**
 * CPC Plus 4-bit color math
 * The CPC Plus palette is a 4096-color RGB cube (4 bits per component),
 * organized as index = r * 256 + g * 16 + b.
 */

/**
 * Convert 8-bit RGB value (0-255) to 4-bit CPC Plus level (0-15)
 * Uses round() to find the nearest level
 */
export function toCPCPlusLevel(value: number): number {
  const clamped = Math.max(0, Math.min(255, value))
  return Math.round((clamped / 255) * 15)
}

/**
 * CPC Plus: Get palette index directly from RGB color
 * This is O(1) instead of O(4096) for findClosestColorIndex
 */
export function getCPCPlusPaletteIndex(color: readonly number[]): number {
  const r4 = toCPCPlusLevel(color[0])
  const g4 = toCPCPlusLevel(color[1])
  const b4 = toCPCPlusLevel(color[2])
  return r4 * 256 + g4 * 16 + b4
}
