/**
 * Convolution Kernels Library
 *
 * Predefined 3x3 kernels for common image filters.
 * All kernels are normalized (sum ≈ 1) except for edge detection.
 *
 * Kernel layout as flat array (row-major):
 *   [0] [1] [2]
 *   [3] [4] [5]
 *   [6] [7] [8]
 *
 * Usage: Convert to mat3 for GLSL as column-major:
 *   mat3 = [[0,3,6], [1,4,7], [2,5,8]]
 */

/**
 * Identity kernel - no change
 */
export const KERNEL_IDENTITY = [0, 0, 0, 0, 1, 0, 0, 0, 0]

/**
 * Sharpen kernel - enhances edges
 * Sum = 1, amplifies high frequencies
 */
export const KERNEL_SHARPEN = [0, -1, 0, -1, 5, -1, 0, -1, 0]

/**
 * Sharpen (strong) - more aggressive edge enhancement
 * Sum = 1
 */
export const KERNEL_SHARPEN_STRONG = [-1, -1, -1, -1, 9, -1, -1, -1, -1]

/**
 * Blur kernel - simple box blur (average)
 * Sum = 1
 */
export const KERNEL_BLUR_BOX = [
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9
]

/**
 * Blur kernel - Gaussian approximation 3x3
 * Sum = 16/16 = 1
 */
export const KERNEL_BLUR_GAUSSIAN = [
  1 / 16,
  2 / 16,
  1 / 16,
  2 / 16,
  4 / 16,
  2 / 16,
  1 / 16,
  2 / 16,
  1 / 16
]

/**
 * Edge enhance - subtle edge enhancement
 * Sum = 1
 */
export const KERNEL_EDGE_ENHANCE = [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0]

/**
 * Emboss kernel - creates 3D relief effect
 * Sum = 0 (shifts result, may need bias)
 */
export const KERNEL_EMBOSS = [-2, -1, 0, -1, 1, 1, 0, 1, 2]

/**
 * Convert row-major kernel array to column-major mat3 for GLSL
 * GLSL mat3 is column-major: mat3[col][row]
 *
 * Input:  [0,1,2,3,4,5,6,7,8] (row-major)
 * Output: [[0,3,6],[1,4,7],[2,5,8]] (column-major for GLSL)
 */
export function kernelToMat3(kernel: number[]): number[] {
  return [
    kernel[0],
    kernel[3],
    kernel[6], // Column 0
    kernel[1],
    kernel[4],
    kernel[7], // Column 1
    kernel[2],
    kernel[5],
    kernel[8] // Column 2
  ]
}

/**
 * Create unsharp mask kernel with given amount
 * Unsharp mask: original + amount * (original - blur)
 * = (1 + amount) * original - amount * blur
 *
 * @param amount - Sharpening strength (0 = no change, 1 = default sharpen)
 * @returns 3x3 kernel array (row-major)
 */
export function createSharpenKernel(amount: number): number[] {
  // Gaussian blur kernel weights
  const blur = KERNEL_BLUR_GAUSSIAN

  // Unsharp mask = identity + amount * (identity - blur)
  // = identity * (1 + amount) - blur * amount
  return KERNEL_IDENTITY.map(
    (identity, i) => identity * (1 + amount) - blur[i] * amount
  )
}

/**
 * Create blur kernel with given radius approximation
 * Uses weighted blend between identity and Gaussian
 *
 * @param strength - Blur strength (0 = no blur, 1 = full Gaussian)
 * @returns 3x3 kernel array (row-major)
 */
export function createBlurKernel(strength: number): number[] {
  const clampedStrength = Math.max(0, Math.min(1, strength))
  return KERNEL_IDENTITY.map(
    (identity, i) =>
      identity * (1 - clampedStrength) +
      KERNEL_BLUR_GAUSSIAN[i] * clampedStrength
  )
}

/**
 * Available convolution filter types
 */
export type ConvolutionFilterType = 'sharpen' | 'blur' | 'edgeEnhance' | 'none'

/**
 * Configuration for convolution filters
 */
export interface ConvolutionConfig {
  /** Sharpen amount: 0 = off, 0.5 = subtle, 1.0 = strong, 2.0 = very strong */
  sharpen: number
  /** Blur strength: 0 = off, 1 = full Gaussian blur */
  blur: number
}

/**
 * Default convolution config (no filters)
 */
export const DEFAULT_CONVOLUTION_CONFIG: ConvolutionConfig = {
  sharpen: 0,
  blur: 0
}

/**
 * Check if convolution is needed (any filter active)
 */
export function isConvolutionActive(config: ConvolutionConfig): boolean {
  return config.sharpen !== 0 || config.blur !== 0
}
