/**
 * Development-only atoms for tuning raster dithering constants
 */

import { atomWithStorage } from 'jotai/utils'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  VERTICAL_ERROR_COEFFICIENT
} from '@/libs/pixsaur-raster/raster-constants'

/**
 * Enable/disable raster tuning panel
 */
export const rasterTuningEnabledAtom = atomWithStorage(
  'raster-tuning-enabled',
  false
)

/**
 * Vertical error coefficient
 * Default: 1/8 = 0.125
 */
export const verticalErrorCoefficientAtom = atomWithStorage(
  'raster-vertical-error-coefficient',
  VERTICAL_ERROR_COEFFICIENT
)

/**
 * Horizontal error coefficient
 * Default: 1/2 = 0.5
 */
export const horizontalErrorCoefficientAtom = atomWithStorage(
  'raster-horizontal-error-coefficient',
  HORIZONTAL_ERROR_COEFFICIENT
)
