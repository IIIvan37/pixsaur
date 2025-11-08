/**
 * Luminance calculation utilities
 * Provides functions to calculate relative luminance of RGB colors
 * using different standards (Rec. 709)
 */

import type { Vector } from '../type'

/**
 * Calculate relative luminance from RGB [0-255] using Rec. 709 Y formula
 * This is a fast approximation suitable for color palette algorithms
 *
 * @param color - RGB color vector [r, g, b] with values in range [0-255]
 * @returns Luminance value in range [0-1]
 */
export function luminance([r, g, b]: Vector): number {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * Calculate relative luminance with gamma correction (sRGB to linear RGB)
 * This is more accurate and should be used for accessibility calculations
 * and precise color comparisons
 *
 * Based on WCAG 2.0 relative luminance calculation
 * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
 *
 * @param color - RGB color vector [r, g, b] with values in range [0-255]
 * @returns Luminance value in range [0-1]
 */
export function luminanceGammaCorrected([r, g, b]: Vector): number {
  const toLinear = (component: number): number => {
    const normalized = component / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  const R = toLinear(r)
  const G = toLinear(g)
  const B = toLinear(b)

  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * Check if a color is dark (luminance < 0.2)
 * Useful for determining text/icon color on colored backgrounds
 *
 * @param color - RGB color vector [r, g, b]
 * @returns true if the color is considered dark
 */
export function isDark(color: Vector): boolean {
  return luminance(color) < 0.2
}

/**
 * Check if a color is bright (luminance > 0.8)
 * Useful for determining text/icon color on colored backgrounds
 *
 * @param color - RGB color vector [r, g, b]
 * @returns true if the color is considered bright
 */
export function isBright(color: Vector): boolean {
  return luminance(color) > 0.8
}
