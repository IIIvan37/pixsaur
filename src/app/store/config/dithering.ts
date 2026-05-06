/**
 * Dithering Configuration
 *
 * Single responsibility: Dithering and color space settings
 */

import { atom } from 'jotai'
import type { DitheringConfig } from '@/libs/pixsaur-color/src'
import type { ColorSpace } from '@/libs/pixsaur-color/src/type'

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * Color space for quantization
 */
export const colorSpaceAtom = atom<ColorSpace>('RGB')

/**
 * Dithering configuration
 */
export const ditheringAtom = atom<DitheringConfig>({
  mode: 'floydSteinberg',
  intensity: 0.5,
  useDiffusionCorrection: true,
  useOrderedCorrection: true
})

// ============================================================================
// SETTERS
// ============================================================================

/**
 * Partial setter for dithering config
 */
export const setDitheringAtom = atom(
  null,
  (get, set, payload: Partial<DitheringConfig>) => {
    const prev = get(ditheringAtom)
    set(ditheringAtom, { ...prev, ...payload })
  }
)

/**
 * Setter for color space
 */
export const setColorSpaceAtom = atom(
  null,
  (_get, set, payload: ColorSpace) => {
    set(colorSpaceAtom, payload)
  }
)

/**
 * Switch dithering to a raster-compatible mode if using error diffusion
 */
export const switchToRasterCompatibleDitheringAtom = atom(null, (get, set) => {
  const currentDithering = get(ditheringAtom)
  const errorDiffusionModes = [
    'floydSteinberg',
    'atkinson',
    'ylioluma1',
    'ylioluma2'
  ]

  if (
    currentDithering.mode !== 'none' &&
    errorDiffusionModes.includes(currentDithering.mode)
  ) {
    set(ditheringAtom, {
      mode: 'bayer2x2',
      intensity: 0.25
    })
  }
})
