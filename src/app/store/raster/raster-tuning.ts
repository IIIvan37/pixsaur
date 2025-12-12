/**
 * Atoms for tuning raster dithering and palette selection parameters
 */

import { atomWithStorage } from 'jotai/utils'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PREPROCESS_CONTINUITY_BONUS,
  PREPROCESS_CONTINUITY_DISTANCE,
  PREPROCESS_FREQUENCY_EXPONENT,
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

/**
 * ============================================================================
 * PREPROCESSING PARAMETERS
 * Control how the image is preprocessed before raster optimization.
 * These affect the base palette extraction.
 * ============================================================================
 */

/**
 * Preprocessing: Palette continuity distance threshold
 * Default: 867 (17² × 3)
 */
export const preprocessContinuityDistanceAtom = atomWithStorage(
  'raster-preprocess-continuity-distance',
  PREPROCESS_CONTINUITY_DISTANCE
)

/**
 * Preprocessing: Palette continuity bonus multiplier
 * Default: 1.5 (50% bonus)
 */
export const preprocessContinuityBonusAtom = atomWithStorage(
  'raster-preprocess-continuity-bonus',
  PREPROCESS_CONTINUITY_BONUS
)

/**
 * Preprocessing: Palette frequency exponent
 * Default: 0.5 (square root weighting)
 */
export const preprocessFrequencyExponentAtom = atomWithStorage(
  'raster-preprocess-frequency-exponent',
  PREPROCESS_FREQUENCY_EXPONENT
)
