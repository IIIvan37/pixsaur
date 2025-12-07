import { atomWithStorage } from 'jotai/utils'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

/** Max raster changes per line: 1 for most modes, 4 for Plus Mode 1 only */
export const MAX_CHANGES_PER_LINE_DEFAULT = 1
export const MAX_CHANGES_PER_LINE_PLUS_MODE1 = 4

/**
 * Whether raster mode is enabled
 */
export const rasterEnabledAtom = atomWithStorage<boolean>(
  'pixsaur-raster-enabled',
  false
)

/**
 * Raster dithering intensity (0 = no dithering, 1 = full dithering)
 * Default: 0.75 for good quality with minimal noise
 */
export const rasterDitheringIntensityAtom = atomWithStorage<number>(
  'pixsaur-raster-dithering-intensity',
  0.75
)

/**
 * Maximum number of ink changes per line
 * 1 = classic raster (one ink change per HBL)
 * 4 = full raster (all 4 inks can change per line)
 * Default: 1 for classic raster behavior
 */
export const rasterMaxChangesPerLineAtom = atomWithStorage<number>(
  'pixsaur-raster-max-changes-per-line',
  1
)

/**
 * User-defined raster changes (single line changes, no ranges)
 */
export const rasterChangesAtom = atomWithStorage<RasterChange[]>(
  'pixsaur-raster-changes',
  []
)
