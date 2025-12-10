/**
 * Shared dithering modes configuration and utilities
 */

import type { DitheringMode } from '@/libs/pixsaur-color/src'

export type DitheringModeOption = {
  value: DitheringMode
  label: string
}

/**
 * All available dithering modes with their labels
 */
export const ALL_DITHERING_MODES: readonly DitheringModeOption[] = [
  { value: 'floydSteinberg', label: 'Floyd–Steinberg' },
  { value: 'bayer2x2', label: 'Bayer 2x2' },
  { value: 'bayer4x4', label: 'Bayer 4x4' },
  { value: 'bayer8x8', label: 'bayer 8x8' },
  { value: 'ylioluma1', label: 'Ylioluma 1' },
  { value: 'ylioluma2', label: 'Ylioluma 2' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'halftone4x4', label: 'Halftone 4x4' }
] as const

/**
 * Error diffusion modes (not compatible with raster mode)
 */
const ERROR_DIFFUSION_MODES: readonly DitheringMode[] = [
  'floydSteinberg',
  'atkinson',
  'ylioluma1',
  'ylioluma2'
] as const

/**
 * Check if a dithering mode is compatible with raster mode
 */
export function isRasterCompatibleMode(mode: DitheringMode): boolean {
  return !ERROR_DIFFUSION_MODES.includes(mode)
}

/**
 * Returns dithering modes compatible with raster mode
 * (excludes error diffusion algorithms)
 */
export function getRasterCompatibleModes(): readonly DitheringModeOption[] {
  return ALL_DITHERING_MODES.filter(
    (mode) => !ERROR_DIFFUSION_MODES.includes(mode.value)
  )
}

/**
 * Returns the default intensity for a given dithering mode.
 */
export function getDefaultDitheringIntensity(mode: DitheringMode): number {
  switch (mode) {
    case 'floydSteinberg':
      return 0.5
    case 'atkinson':
      return 0.5
    case 'bayer2x2':
      return 0.25
    case 'bayer4x4':
      return 0.25
    case 'bayer8x8':
      return 0.25
    case 'halftone4x4':
      return 0.08
    case 'ylioluma1':
      return 0.16
    case 'ylioluma2':
      return 1
    default:
      return 0.5
  }
}
