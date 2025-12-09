/**
 * Dithering error propagation constants for raster preprocessing
 *
 * These control how quantization error is diffused during the preprocessing
 * phase that reduces each line to exactly 4 colors before raster optimization.
 */

/**
 * Vertical error propagation coefficient for raster preprocessing dithering.
 *
 * This controls how much error is propagated to the line below.
 * Lower values reduce vertical banding but may increase horizontal patterns.
 *
 * ANTI-BANDING: Reduced from 1/4 (0.25) to 1/8 (0.125) to minimize
 * vertical banding in gradients while preserving horizontal smoothing.
 *
 * Value: 1/8 (0.125) - was 1/4 (0.25)
 */
export const VERTICAL_ERROR_COEFFICIENT = 1 / 8

/**
 * Horizontal error propagation coefficient for raster preprocessing dithering.
 *
 * This controls how much error is propagated to the next pixel on the same line.
 *
 * Value: 1/2 (0.5) - standard Floyd-Steinberg horizontal coefficient
 */
export const HORIZONTAL_ERROR_COEFFICIENT = 1 / 2
