import { Vector } from '../type'

/**
 * Approximate luminance from RGB [0–1] using Rec. 709 Y formula.
 *
 * @param rgb - Vector in RGB space (0–255 range).
 * @returns Luminance value in [0, 1].
 */
export function luminance([r, g, b]: Vector): number {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * Returns true if the color is considered dark (luminance < 0.2)
 */
export function isDark(color: Vector): boolean {
  return luminance(color) < 0.2
}

/**
 * Returns true if the color is considered bright (luminance > 0.8)
 */
export function isBright(color: Vector): boolean {
  return luminance(color) > 0.8
}
