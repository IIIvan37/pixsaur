/**
 * Per-channel sRGB <-> linear-light conversion.
 *
 * Resampling (averaging pixels) must happen in linear light, otherwise the
 * result is too dark and contrast is wrong on fine detail. These helpers
 * operate on a single normalized component in [0, 1]; callers handle the
 * 0-255 <-> [0,1] scaling so the math stays pure and testable.
 *
 * The transfer function matches `luminanceGammaCorrected` in ../utils/luminance,
 * using the canonical inverse-pair thresholds (0.04045 / 0.0031308).
 */

/** sRGB component [0,1] -> linear-light [0,1]. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Linear-light component [0,1] -> sRGB [0,1]. */
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
}
