/**
 * Raster Tuning
 *
 * Runtime tuning values for raster optimization.
 * Can be overridden by dev tools for fine-tuning visual quality.
 */

import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PREPROCESS_CONTINUITY_BONUS,
  PREPROCESS_CONTINUITY_DISTANCE,
  PREPROCESS_FREQUENCY_EXPONENT,
  VERTICAL_ERROR_COEFFICIENT
} from './raster-constants'

/**
 * Runtime tuning values for dithering error propagation coefficients
 * Can be overridden by dev tools for fine-tuning visual quality
 */
export const rasterTuningOverrides = {
  // Dithering error propagation
  verticalErrorCoefficient: VERTICAL_ERROR_COEFFICIENT,
  horizontalErrorCoefficient: HORIZONTAL_ERROR_COEFFICIENT,

  // Preprocessing parameters (affects base palette extraction)
  preprocessContinuityDistance: PREPROCESS_CONTINUITY_DISTANCE,
  preprocessContinuityBonus: PREPROCESS_CONTINUITY_BONUS,
  preprocessFrequencyExponent: PREPROCESS_FREQUENCY_EXPONENT
}
