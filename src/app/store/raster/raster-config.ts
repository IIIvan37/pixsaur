import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

/**
 * Whether raster mode is enabled
 * Not persisted - disabled by default on each session
 */
export const rasterEnabledAtom = atom(false)

/**
 * Raster dithering intensity (0 = no dithering, 1 = full dithering)
 */
export const rasterDitheringIntensityAtom = atomWithStorage(
  'pixsaur-raster-dithering-intensity',
  0.75
)

/**
 * Maximum number of ink changes per line
 * Classic: max 2, Plus: max 4
 */
export const rasterMaxChangesPerLineAtom = atomWithStorage(
  'pixsaur-raster-max-changes-per-line',
  1
)

/**
 * User-defined raster changes
 * Not persisted - reset on each session
 */
export const rasterChangesAtom = atom<RasterChange[]>([])
