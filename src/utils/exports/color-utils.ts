/**
 * Utility functions for color analysis and mapping
 */
import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * Finds the darkest color in a palette based on luminance
 * @param palette Array of RGB color vectors
 * @returns The darkest color vector from the palette
 */
export function findDarkestColor(palette: Vector[]): Vector {
  if (palette.length === 0) {
    throw new Error('Palette cannot be empty')
  }

  let darkestColor = palette[0]
  let minLuminance = calculateLuminance(darkestColor)

  for (const color of palette) {
    const luminance = calculateLuminance(color)
    if (luminance < minLuminance) {
      minLuminance = luminance
      darkestColor = color
    }
  }

  return darkestColor
}

/**
 * Calculates the relative luminance of an RGB color
 * Based on ITU-R BT.709 standard
 * @param color RGB color vector [r, g, b]
 * @returns Luminance value between 0 and 1
 */
function calculateLuminance(color: Vector): number {
  const [r, g, b] = color.map((component) => {
    const normalized = component / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
