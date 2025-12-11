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

/**
 * Palette selection constants for Farthest Point Sampling algorithm
 *
 * These control how the algorithm balances between:
 * - Color diversity (selecting colors far apart)
 * - Color importance (selecting frequent colors)
 * - Palette stability (preferring colors similar to previous line)
 */

/**
 * Distance threshold for palette continuity.
 *
 * Colors within this distance from the previous palette get a continuity bonus.
 * This reduces palette flickering between lines with similar colors.
 *
 * Formula: 17² × 3 = 867 (approximately 1 CPC Plus step per channel)
 *
 * - Lower values (500-700): More strict, less continuity, better color accuracy
 * - Higher values (1000-1500): More continuity, smoother gradients, risk of color drift
 *
 * Value: 867 (17² × 3)
 */
export const PALETTE_CONTINUITY_DISTANCE = 17 * 17 * 3

/**
 * Bonus multiplier for colors similar to previous palette.
 *
 * This bonus is applied to the selection score of colors that are within
 * PALETTE_CONTINUITY_DISTANCE of the previous palette.
 *
 * - Lower values (1.0-1.2): Weak continuity, more color changes
 * - Higher values (1.5-2.0): Strong continuity, stable palette across lines
 *
 * Value: 1.5 (50% bonus)
 */
export const PALETTE_CONTINUITY_BONUS = 1.5

/**
 * Frequency weight exponent for palette selection.
 *
 * Controls how much color frequency influences palette selection:
 * - 0.0: Frequency ignored (pure farthest point sampling)
 * - 0.5: Square root weighting (default, balanced)
 * - 1.0: Linear weighting (strong preference for frequent colors)
 *
 * Value: 0.5 (square root)
 */
export const PALETTE_FREQUENCY_EXPONENT = 0.5

/**
 * Mode 0 CPC Plus global palette extraction constants.
 *
 * These control how the 12 "fixed" colors are selected for Mode 0 CPC Plus.
 * The algorithm uses a globalScore = W1 * pixelCount + W2 * lineCount * (width/4)
 * to favor colors that appear on many lines (not just total pixel count).
 */

/**
 * Weight for pixel frequency in Mode 0 global color scoring.
 *
 * Higher values favor colors with more total pixels.
 *
 * Value: 1 (baseline weight)
 */
export const MODE_0_PIXEL_WEIGHT = 1

/**
 * Weight for line coverage in Mode 0 global color scoring.
 *
 * Higher values favor colors that appear on many different lines,
 * which is important for raster optimization (colors should span the image).
 *
 * Value: 2 (double weight compared to pixel count)
 */
export const MODE_0_LINE_WEIGHT = 2
