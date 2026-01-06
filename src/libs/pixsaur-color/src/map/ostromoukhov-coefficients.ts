/**
 * Ostromoukhov Error Diffusion Coefficients
 *
 * Based on: V. Ostromoukhov, "A Simple and Efficient Error-Diffusion Algorithm"
 * SIGGRAPH 2001
 *
 * These coefficients are designed to:
 * 1. Produce blue-noise spectra at each intensity level
 * 2. Eliminate "worm" artifacts common in Floyd-Steinberg
 * 3. Use only 3 neighboring pixels for faster processing
 *
 * Format: [right, down-left, down, divisor] for each intensity level 0-255
 * The coefficients are symmetric around 127, so we only store 0-127 and mirror.
 */

// Coefficients for intensity levels 0-127 (will be mirrored for 128-255)
// Format: [right coefficient, down-left coefficient, down coefficient, sum]
const OSTROMOUKHOV_HALF: [number, number, number, number][] = [
  [13, 0, 5, 18],
  [13, 0, 5, 18],
  [21, 0, 10, 31],
  [7, 0, 4, 11],
  [8, 0, 5, 13],
  [47, 3, 28, 78],
  [23, 3, 13, 39],
  [15, 3, 8, 26],
  [22, 6, 11, 39],
  [43, 15, 20, 78],
  [7, 3, 3, 13],
  [501, 224, 211, 936],
  [249, 116, 103, 468],
  [165, 80, 67, 312],
  [123, 62, 49, 234],
  [489, 256, 191, 936],
  [81, 44, 31, 156],
  [483, 272, 181, 936],
  [60, 35, 22, 117],
  [53, 32, 19, 104],
  [237, 148, 83, 468],
  [471, 304, 161, 936],
  [3, 2, 1, 6],
  [459, 304, 161, 924],
  [38, 25, 14, 77],
  [453, 296, 175, 924],
  [225, 146, 91, 462],
  [149, 96, 63, 308],
  [111, 71, 49, 231],
  [63, 40, 29, 132],
  [73, 46, 35, 154],
  [435, 272, 217, 924],
  [108, 67, 56, 231],
  [13, 8, 7, 28],
  [213, 130, 119, 462],
  [423, 256, 245, 924],
  [5, 3, 3, 11],
  [281, 173, 162, 616],
  [141, 89, 78, 308],
  [283, 183, 150, 616],
  [71, 47, 36, 154],
  [285, 193, 138, 616],
  [13, 9, 6, 28],
  [41, 29, 18, 88],
  [36, 26, 15, 77],
  [289, 213, 114, 616],
  [145, 109, 54, 308],
  [291, 223, 102, 616],
  [73, 57, 24, 154],
  [293, 233, 90, 616],
  [21, 17, 6, 44],
  [295, 243, 78, 616],
  [37, 31, 9, 77],
  [27, 23, 6, 56],
  [149, 129, 30, 308],
  [299, 263, 54, 616],
  [75, 67, 12, 154],
  [43, 39, 6, 88],
  [151, 139, 18, 308],
  [303, 283, 30, 616],
  [38, 36, 3, 77],
  [305, 293, 18, 616],
  [153, 149, 6, 308],
  [307, 303, 6, 616],
  [1, 1, 0, 2],
  [101, 105, 2, 208],
  [49, 53, 2, 104],
  [95, 107, 6, 208],
  [23, 27, 2, 52],
  [89, 109, 10, 208],
  [43, 55, 6, 104],
  [83, 111, 14, 208],
  [5, 7, 1, 13],
  [172, 181, 37, 390],
  [97, 76, 22, 195],
  [72, 41, 17, 130],
  [119, 47, 29, 195],
  [4, 1, 1, 6],
  [4, 1, 1, 6],
  [4, 1, 1, 6],
  [4, 1, 1, 6],
  [4, 1, 1, 6],
  [4, 1, 1, 6],
  [4, 1, 1, 6],
  [4, 1, 1, 6],
  [4, 1, 1, 6],
  [65, 18, 17, 100],
  [95, 29, 26, 150],
  [185, 62, 53, 300],
  [30, 11, 9, 50],
  [35, 14, 11, 60],
  [85, 37, 28, 150],
  [55, 26, 19, 100],
  [80, 41, 29, 150],
  [155, 86, 59, 300],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [5, 3, 2, 10],
  [305, 176, 119, 600],
  [155, 86, 59, 300],
  [105, 56, 39, 200],
  [80, 41, 29, 150],
  [65, 32, 23, 120],
  [55, 26, 19, 100],
  [335, 152, 113, 600],
  [85, 37, 28, 150],
  [115, 48, 37, 200],
  [35, 14, 11, 60],
  [355, 136, 109, 600],
  [30, 11, 9, 50],
  [365, 128, 107, 600],
  [185, 62, 53, 300],
  [25, 8, 7, 40],
  [95, 29, 26, 150],
  [385, 112, 103, 600],
  [65, 18, 17, 100],
  [395, 104, 101, 600],
  [49, 14, 13, 76],
  [27, 7, 7, 41]
]

/**
 * Full Ostromoukhov coefficients table (0-255)
 * Mirrored from 0-127 to 128-255
 */
export const OSTROMOUKHOV_COEFFICIENTS: [number, number, number, number][] = [
  ...OSTROMOUKHOV_HALF,
  ...OSTROMOUKHOV_HALF.slice().reverse()
]

/**
 * Get the diffusion coefficients for a given intensity level (0-255)
 * Returns normalized coefficients [right, down-left, down]
 */
export function getOstromoukhovCoefficients(
  intensity: number
): [number, number, number] {
  const idx = Math.max(0, Math.min(255, Math.round(intensity)))
  const coeff = OSTROMOUKHOV_COEFFICIENTS[idx]
  // Fallback to Floyd-Steinberg-like distribution if coefficient is missing
  if (!coeff) {
    return [7 / 16, 3 / 16, 5 / 16]
  }
  const [r, dl, d, sum] = coeff
  return [r / sum, dl / sum, d / sum]
}
