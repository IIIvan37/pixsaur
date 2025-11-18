/**
 * Utility functions for color analysis and mapping
 */
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { luminanceGammaCorrected } from '@/libs/pixsaur-color/src/utils/luminance'

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
  let minLuminance = luminanceGammaCorrected(darkestColor)

  for (const color of palette) {
    const luminance = luminanceGammaCorrected(color)
    if (luminance < minLuminance) {
      minLuminance = luminance
      darkestColor = color
    }
  }

  return darkestColor
}
