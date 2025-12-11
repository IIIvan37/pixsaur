/**
 * Atoms for tuning raster dithering and palette selection parameters
 */

import { atomWithStorage } from 'jotai/utils'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  MODE_0_LINE_WEIGHT,
  MODE_0_PIXEL_WEIGHT,
  PALETTE_CONTINUITY_BONUS,
  PALETTE_CONTINUITY_DISTANCE,
  PALETTE_FREQUENCY_EXPONENT,
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
 * Palette continuity distance threshold
 * Default: 867 (17² × 3)
 */
export const paletteContinuityDistanceAtom = atomWithStorage(
  'raster-palette-continuity-distance',
  PALETTE_CONTINUITY_DISTANCE
)

/**
 * Palette continuity bonus multiplier
 * Default: 1.5 (50% bonus)
 */
export const paletteContinuityBonusAtom = atomWithStorage(
  'raster-palette-continuity-bonus',
  PALETTE_CONTINUITY_BONUS
)

/**
 * Palette frequency exponent
 * Default: 0.5 (square root weighting)
 */
export const paletteFrequencyExponentAtom = atomWithStorage(
  'raster-palette-frequency-exponent',
  PALETTE_FREQUENCY_EXPONENT
)

/**
 * Mode 0 CPC Plus: Pixel frequency weight for global palette extraction
 * Default: 1 (baseline)
 */
export const mode0PixelWeightAtom = atomWithStorage(
  'raster-mode0-pixel-weight',
  MODE_0_PIXEL_WEIGHT
)

/**
 * Mode 0 CPC Plus: Line coverage weight for global palette extraction
 * Higher = prefer colors that span many lines
 * Default: 2 (double weight vs pixels)
 */
export const mode0LineWeightAtom = atomWithStorage(
  'raster-mode0-line-weight',
  MODE_0_LINE_WEIGHT
)
