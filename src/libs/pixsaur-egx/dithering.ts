/**
 * EGX-Aware Dithering
 *
 * Dithering algorithms optimized for EGX mode constraints.
 *
 * The key difference from standard dithering:
 * - Standard: dither with full palette, then re-quantize to sub-palette (double quantization)
 * - EGX-aware: dither directly with the sub-palette for each line (single quantization)
 *
 * This produces better results because the error diffusion is computed
 * with the actual colors available for each line.
 *
 * Also handles pixel grouping constraints on low-resolution lines.
 */

import { getOstromoukhovCoefficients } from '@/libs/pixsaur-color/src/map/ostromoukhov-coefficients'
import { findClosestInSubset } from '@/libs/pixsaur-color/src/metric/find-closest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig } from './types'
import { getMaxColorIndex, getModeForLine } from './types'

// ============================================================================
// EGX Helpers
// ============================================================================

/**
 * Compute bounding box of the full EGX palette.
 * Used for diffusion correction (clamp pixel+error to gamut) and ordered correction (boundary skip).
 */
function computeEGXPaletteBounds(palette: Vector<'RGB'>[]): {
  min: [number, number, number]
  max: [number, number, number]
} {
  const min: [number, number, number] = [255, 255, 255]
  const max: [number, number, number] = [0, 0, 0]
  for (const c of palette) {
    if (c[0] < min[0]) min[0] = c[0]
    if (c[1] < min[1]) min[1] = c[1]
    if (c[2] < min[2]) min[2] = c[2]
    if (c[0] > max[0]) max[0] = c[0]
    if (c[1] > max[1]) max[1] = c[1]
    if (c[2] > max[2]) max[2] = c[2]
  }
  return { min, max }
}

// ============================================================================
// EGX Pixel Grouping
// ============================================================================

/**
 * Post-process a dithered buffer to ensure pixels are grouped correctly on low-res lines.
 * On low-res lines (Mode 0 for EGX1, Mode 1 for EGX2), each CPC pixel spans 2 buffer pixels.
 * This function ensures both pixels in a pair have the same color by averaging and re-quantizing.
 */
function enforcePixelGrouping(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Vector<'RGB'>[],
  config: EGXConfig
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(buffer)
  const highResMode = config.type === 'egx1' ? 1 : 2

  for (let y = 0; y < height; y++) {
    const lineMode = getModeForLine(y, config)
    const isLowResLine = lineMode !== highResMode

    if (!isLowResLine) continue

    const maxColorIndex = getMaxColorIndex(lineMode, config.type)

    // Process pixels in pairs
    for (let x = 0; x < width - 1; x += 2) {
      const idx1 = (y * width + x) * 4
      const idx2 = (y * width + x + 1) * 4

      // Average the two pixels
      const avgR = Math.round((buffer[idx1] + buffer[idx2]) / 2)
      const avgG = Math.round((buffer[idx1 + 1] + buffer[idx2 + 1]) / 2)
      const avgB = Math.round((buffer[idx1 + 2] + buffer[idx2 + 2]) / 2)

      // Find closest color in sub-palette
      const { color } = findClosestInSubset(
        [avgR, avgG, avgB],
        palette,
        maxColorIndex
      )

      // Assign same color to both pixels
      output[idx1] = color[0]
      output[idx1 + 1] = color[1]
      output[idx1 + 2] = color[2]
      output[idx2] = color[0]
      output[idx2 + 1] = color[1]
      output[idx2 + 2] = color[2]
    }
  }

  return output
}

// ============================================================================
// EGX-Aware Dithering Algorithms
// ============================================================================

/**
 * Floyd-Steinberg dithering adapted for EGX mode.
 * Each line uses its own sub-palette based on EGX constraints.
 */
function applyEGXFloydSteinbergDithering(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig,
  intensity: number
): Uint8ClampedArray {
  const { width, height, data } = imageData
  const output = new Uint8ClampedArray(width * height * 4)

  // Working buffer with floating point for error accumulation
  const errorBuffer = new Float32Array(width * height * 3)

  // Initialize from source image
  for (let i = 0; i < width * height; i++) {
    errorBuffer[i * 3] = data[i * 4]
    errorBuffer[i * 3 + 1] = data[i * 4 + 1]
    errorBuffer[i * 3 + 2] = data[i * 4 + 2]
  }

  const useDiffusionCorrection = config.useDiffusionCorrection ?? true
  const ERROR_CLAMP = 64
  const bounds = useDiffusionCorrection
    ? computeEGXPaletteBounds(palette)
    : null
  const clampErr = (v: number) =>
    useDiffusionCorrection
      ? Math.max(-ERROR_CLAMP, Math.min(ERROR_CLAMP, v))
      : v

  // Floyd-Steinberg weights
  const FS_RIGHT = (7 / 16) * intensity
  const FS_BOTTOM_LEFT = (3 / 16) * intensity
  const FS_BOTTOM = (5 / 16) * intensity
  const FS_BOTTOM_RIGHT = (1 / 16) * intensity

  for (let y = 0; y < height; y++) {
    // Get the sub-palette limit for this line
    const lineMode = getModeForLine(y, config)
    const maxColorIndex = getMaxColorIndex(lineMode, config.type)

    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const idx3 = idx * 3
      const idx4 = idx * 4

      // Get current pixel with accumulated error (clamped to palette gamut if correction enabled)
      const r = bounds
        ? Math.max(bounds.min[0], Math.min(bounds.max[0], errorBuffer[idx3]))
        : Math.max(0, Math.min(255, errorBuffer[idx3]))
      const g = bounds
        ? Math.max(
            bounds.min[1],
            Math.min(bounds.max[1], errorBuffer[idx3 + 1])
          )
        : Math.max(0, Math.min(255, errorBuffer[idx3 + 1]))
      const b = bounds
        ? Math.max(
            bounds.min[2],
            Math.min(bounds.max[2], errorBuffer[idx3 + 2])
          )
        : Math.max(0, Math.min(255, errorBuffer[idx3 + 2]))

      // Find closest color in the sub-palette for this line
      const { color } = findClosestInSubset([r, g, b], palette, maxColorIndex)

      // Output the quantized color
      output[idx4] = color[0]
      output[idx4 + 1] = color[1]
      output[idx4 + 2] = color[2]
      output[idx4 + 3] = 255

      // Calculate quantization error (clamped to prevent smearing if correction enabled)
      const errR = clampErr(r - color[0])
      const errG = clampErr(g - color[1])
      const errB = clampErr(b - color[2])

      // Distribute error to neighbors (Floyd-Steinberg pattern)
      // Right pixel (x+1, y)
      if (x + 1 < width) {
        const rightIdx = idx3 + 3
        errorBuffer[rightIdx] += errR * FS_RIGHT
        errorBuffer[rightIdx + 1] += errG * FS_RIGHT
        errorBuffer[rightIdx + 2] += errB * FS_RIGHT
      }

      // Bottom-left pixel (x-1, y+1)
      if (x > 0 && y + 1 < height) {
        const blIdx = (idx + width - 1) * 3
        errorBuffer[blIdx] += errR * FS_BOTTOM_LEFT
        errorBuffer[blIdx + 1] += errG * FS_BOTTOM_LEFT
        errorBuffer[blIdx + 2] += errB * FS_BOTTOM_LEFT
      }

      // Bottom pixel (x, y+1)
      if (y + 1 < height) {
        const bIdx = (idx + width) * 3
        errorBuffer[bIdx] += errR * FS_BOTTOM
        errorBuffer[bIdx + 1] += errG * FS_BOTTOM
        errorBuffer[bIdx + 2] += errB * FS_BOTTOM
      }

      // Bottom-right pixel (x+1, y+1)
      if (x + 1 < width && y + 1 < height) {
        const brIdx = (idx + width + 1) * 3
        errorBuffer[brIdx] += errR * FS_BOTTOM_RIGHT
        errorBuffer[brIdx + 1] += errG * FS_BOTTOM_RIGHT
        errorBuffer[brIdx + 2] += errB * FS_BOTTOM_RIGHT
      }
    }
  }

  return output
}

/**
 * EGX-aware Ostromoukhov Error Diffusion
 *
 * Uses variable coefficients based on intensity level for improved blue-noise
 * spectrum and elimination of "worm" artifacts. Applies EGX constraints
 * with proper sub-palette selection per line.
 *
 * Key features:
 * - Variable diffusion coefficients per intensity (256 precomputed sets)
 * - Serpentine scanning for better error distribution
 * - Only 3 neighbor pixels (faster than Floyd-Steinberg's 4)
 * - Produces high-quality blue-noise patterns
 */
function applyEGXOstromoukhovDithering(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig,
  intensity: number
): Uint8ClampedArray {
  const { width, height, data } = imageData
  const output = new Uint8ClampedArray(width * height * 4)

  // Working buffer with floating point for error accumulation
  const errorBuffer = new Float32Array(width * height * 3)

  // Initialize from source image
  for (let i = 0; i < width * height; i++) {
    errorBuffer[i * 3] = data[i * 4]
    errorBuffer[i * 3 + 1] = data[i * 4 + 1]
    errorBuffer[i * 3 + 2] = data[i * 4 + 2]
  }

  const useDiffusionCorrection = config.useDiffusionCorrection ?? true
  const ERROR_CLAMP = 64
  const bounds = useDiffusionCorrection
    ? computeEGXPaletteBounds(palette)
    : null
  const clampErr = (v: number) =>
    useDiffusionCorrection
      ? Math.max(-ERROR_CLAMP, Math.min(ERROR_CLAMP, v))
      : v

  for (let y = 0; y < height; y++) {
    // Get the sub-palette limit for this line
    const lineMode = getModeForLine(y, config)
    const maxColorIndex = getMaxColorIndex(lineMode, config.type)

    // Serpentine scanning: alternate direction each line
    const leftToRight = y % 2 === 0

    for (let i = 0; i < width; i++) {
      const x = leftToRight ? i : width - 1 - i
      const idx = y * width + x
      const idx3 = idx * 3
      const idx4 = idx * 4

      // Get current pixel with accumulated error (clamped to palette gamut if correction enabled)
      const r = bounds
        ? Math.max(bounds.min[0], Math.min(bounds.max[0], errorBuffer[idx3]))
        : Math.max(0, Math.min(255, errorBuffer[idx3]))
      const g = bounds
        ? Math.max(
            bounds.min[1],
            Math.min(bounds.max[1], errorBuffer[idx3 + 1])
          )
        : Math.max(0, Math.min(255, errorBuffer[idx3 + 1]))
      const b = bounds
        ? Math.max(
            bounds.min[2],
            Math.min(bounds.max[2], errorBuffer[idx3 + 2])
          )
        : Math.max(0, Math.min(255, errorBuffer[idx3 + 2]))

      // Find closest color in the sub-palette for this line
      const { color } = findClosestInSubset([r, g, b], palette, maxColorIndex)

      // Output the quantized color
      output[idx4] = color[0]
      output[idx4 + 1] = color[1]
      output[idx4 + 2] = color[2]
      output[idx4 + 3] = 255

      // Calculate quantization error (clamped to prevent smearing if correction enabled)
      const errR = clampErr(r - color[0])
      const errG = clampErr(g - color[1])
      const errB = clampErr(b - color[2])

      // Get intensity-dependent coefficients from pixel luminance
      const pixelIntensity = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
      const [rightCoef, downLeftCoef, downCoef] =
        getOstromoukhovCoefficients(pixelIntensity)

      // Apply intensity scaling
      const right = rightCoef * intensity
      const downLeft = downLeftCoef * intensity
      const down = downCoef * intensity

      // Distribute error (direction-aware for serpentine scan)
      if (leftToRight) {
        // Right pixel (x+1, y)
        if (x + 1 < width) {
          const rightIdx = idx3 + 3
          errorBuffer[rightIdx] += errR * right
          errorBuffer[rightIdx + 1] += errG * right
          errorBuffer[rightIdx + 2] += errB * right
        }

        // Down-left pixel (x-1, y+1)
        if (x > 0 && y + 1 < height) {
          const dlIdx = (idx + width - 1) * 3
          errorBuffer[dlIdx] += errR * downLeft
          errorBuffer[dlIdx + 1] += errG * downLeft
          errorBuffer[dlIdx + 2] += errB * downLeft
        }
      } else {
        // Left pixel (x-1, y) - serpentine reversal
        if (x > 0) {
          const leftIdx = idx3 - 3
          errorBuffer[leftIdx] += errR * right
          errorBuffer[leftIdx + 1] += errG * right
          errorBuffer[leftIdx + 2] += errB * right
        }

        // Down-right pixel (x+1, y+1) - serpentine reversal
        if (x + 1 < width && y + 1 < height) {
          const drIdx = (idx + width + 1) * 3
          errorBuffer[drIdx] += errR * downLeft
          errorBuffer[drIdx + 1] += errG * downLeft
          errorBuffer[drIdx + 2] += errB * downLeft
        }
      }

      // Down pixel (x, y+1) - same for both directions
      if (y + 1 < height) {
        const downIdx = (idx + width) * 3
        errorBuffer[downIdx] += errR * down
        errorBuffer[downIdx + 1] += errG * down
        errorBuffer[downIdx + 2] += errB * down
      }
    }
  }

  return output
}

/**
 * No dithering - direct quantization per line
 */
function applyEGXNoDithering(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig
): Uint8ClampedArray {
  const { width, height, data } = imageData
  const output = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    const lineMode = getModeForLine(y, config)
    const maxColorIndex = getMaxColorIndex(lineMode, config.type)

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const pixel: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]
      const { color } = findClosestInSubset(pixel, palette, maxColorIndex)

      output[idx] = color[0]
      output[idx + 1] = color[1]
      output[idx + 2] = color[2]
      output[idx + 3] = 255
    }
  }

  return output
}

/**
 * Ordered dithering (Bayer) adapted for EGX mode
 */
function applyEGXOrderedDithering(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig,
  intensity: number,
  matrixSize: 2 | 4 | 8
): Uint8ClampedArray {
  const { width, height, data } = imageData
  const output = new Uint8ClampedArray(width * height * 4)

  // Bayer matrices
  const BAYER_2X2 = [
    [0, 2],
    [3, 1]
  ]
  const BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ]
  const BAYER_8X8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ]

  const getMatrix = (size: 2 | 4 | 8) => {
    if (size === 2) return BAYER_2X2
    if (size === 4) return BAYER_4X4
    return BAYER_8X8
  }
  const matrix = getMatrix(matrixSize)
  // Divisor is size * size (same as original algorithm)
  const divisor = matrixSize * matrixSize

  // Ordered correction: adaptive amplitude + boundary skip
  const useOrderedCorrection = config.useOrderedCorrection ?? true
  const orderedBounds = useOrderedCorrection
    ? computeEGXPaletteBounds(palette)
    : null
  const amplitude = useOrderedCorrection
    ? intensity * (255 / Math.sqrt(palette.length))
    : intensity * 255

  for (let y = 0; y < height; y++) {
    const lineMode = getModeForLine(y, config)
    const maxColorIndex = getMaxColorIndex(lineMode, config.type)

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      // Adaptive amplitude: intensity × (255 / √paletteSize) when correction enabled
      const bayerVal = matrix[y % matrixSize][x % matrixSize]
      const threshold = (bayerVal / divisor - 0.5) * amplitude

      // Skip perturbation when pixel is at palette gamut boundary
      const sr = data[idx],
        sg = data[idx + 1],
        sb = data[idx + 2]
      const skipPerturbation =
        orderedBounds !== null &&
        (sr <= orderedBounds.min[0] + 1 || sr >= orderedBounds.max[0] - 1) &&
        (sg <= orderedBounds.min[1] + 1 || sg >= orderedBounds.max[1] - 1) &&
        (sb <= orderedBounds.min[2] + 1 || sb >= orderedBounds.max[2] - 1)
      const r = skipPerturbation
        ? sr
        : Math.max(0, Math.min(255, sr + threshold))
      const g = skipPerturbation
        ? sg
        : Math.max(0, Math.min(255, sg + threshold))
      const b = skipPerturbation
        ? sb
        : Math.max(0, Math.min(255, sb + threshold))

      const { color } = findClosestInSubset([r, g, b], palette, maxColorIndex)

      output[idx] = color[0]
      output[idx + 1] = color[1]
      output[idx + 2] = color[2]
      output[idx + 3] = 255
    }
  }

  return output
}

/**
 * Atkinson dithering adapted for EGX mode
 */
function applyEGXAtkinsonDithering(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig,
  intensity: number
): Uint8ClampedArray {
  const { width, height, data } = imageData
  const output = new Uint8ClampedArray(width * height * 4)
  const errorBuffer = new Float32Array(width * height * 3)

  // Initialize from source
  for (let i = 0; i < width * height; i++) {
    errorBuffer[i * 3] = data[i * 4]
    errorBuffer[i * 3 + 1] = data[i * 4 + 1]
    errorBuffer[i * 3 + 2] = data[i * 4 + 2]
  }

  const useDiffusionCorrection = config.useDiffusionCorrection ?? true
  const ERROR_CLAMP = 64
  const bounds = useDiffusionCorrection
    ? computeEGXPaletteBounds(palette)
    : null
  const clampErr = (v: number) =>
    useDiffusionCorrection
      ? Math.max(-ERROR_CLAMP, Math.min(ERROR_CLAMP, v))
      : v

  // Atkinson distributes 1/8 of error to 6 neighbors (total 6/8 = 3/4)
  const weight = (1 / 8) * intensity

  // Atkinson offsets: (1,0), (2,0), (-1,1), (0,1), (1,1), (0,2)
  const offsets = [
    [1, 0],
    [2, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [0, 2]
  ]

  for (let y = 0; y < height; y++) {
    const lineMode = getModeForLine(y, config)
    const maxColorIndex = getMaxColorIndex(lineMode, config.type)

    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const idx3 = idx * 3
      const idx4 = idx * 4

      const r = bounds
        ? Math.max(bounds.min[0], Math.min(bounds.max[0], errorBuffer[idx3]))
        : Math.max(0, Math.min(255, errorBuffer[idx3]))
      const g = bounds
        ? Math.max(
            bounds.min[1],
            Math.min(bounds.max[1], errorBuffer[idx3 + 1])
          )
        : Math.max(0, Math.min(255, errorBuffer[idx3 + 1]))
      const b = bounds
        ? Math.max(
            bounds.min[2],
            Math.min(bounds.max[2], errorBuffer[idx3 + 2])
          )
        : Math.max(0, Math.min(255, errorBuffer[idx3 + 2]))

      const { color } = findClosestInSubset([r, g, b], palette, maxColorIndex)

      output[idx4] = color[0]
      output[idx4 + 1] = color[1]
      output[idx4 + 2] = color[2]
      output[idx4 + 3] = 255

      const errR = clampErr(r - color[0])
      const errG = clampErr(g - color[1])
      const errB = clampErr(b - color[2])

      // Distribute to 6 neighbors
      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 3
          errorBuffer[nIdx] += errR * weight
          errorBuffer[nIdx + 1] += errG * weight
          errorBuffer[nIdx + 2] += errB * weight
        }
      }
    }
  }

  return output
}

// ============================================================================
// Dithering Dispatcher
// ============================================================================

/**
 * Apply EGX-aware dithering based on the dithering mode.
 * Routes to the appropriate EGX dithering function.
 * Also enforces pixel grouping on low-res lines.
 *
 * @param imageData - Source image data
 * @param palette - Full EGX palette (16 colors for EGX1, 4 for EGX2)
 * @param config - EGX configuration
 * @param mode - Dithering mode name
 * @param intensity - Dithering intensity (0-1)
 * @returns Dithered image buffer with pixel grouping enforced
 */
export function applyEGXDitheringByMode(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig,
  mode: string,
  intensity: number
): Uint8ClampedArray {
  let result: Uint8ClampedArray

  switch (mode) {
    case 'none':
      result = applyEGXNoDithering(imageData, palette, config)
      break
    case 'floydSteinberg':
      result = applyEGXFloydSteinbergDithering(
        imageData,
        palette,
        config,
        intensity
      )
      break
    case 'ostromoukhov':
      result = applyEGXOstromoukhovDithering(
        imageData,
        palette,
        config,
        intensity
      )
      break
    case 'atkinson':
      result = applyEGXAtkinsonDithering(imageData, palette, config, intensity)
      break
    case 'bayer2x2':
      result = applyEGXOrderedDithering(
        imageData,
        palette,
        config,
        intensity,
        2
      )
      break
    case 'bayer4x4':
      result = applyEGXOrderedDithering(
        imageData,
        palette,
        config,
        intensity,
        4
      )
      break
    case 'bayer8x8':
      result = applyEGXOrderedDithering(
        imageData,
        palette,
        config,
        intensity,
        8
      )
      break
    default:
      // For unsupported modes (ylioluma1, ylioluma2, halftone4x4),
      // fall back to Floyd-Steinberg
      result = applyEGXFloydSteinbergDithering(
        imageData,
        palette,
        config,
        intensity
      )
  }

  // Enforce pixel grouping on low-res lines
  // This ensures that paired pixels have the same color (required for CPC hardware)
  return enforcePixelGrouping(
    result,
    imageData.width,
    imageData.height,
    palette,
    config
  )
}

// Re-export color utilities from pixsaur-color for convenience
export {
  colorDistanceSquared,
  findClosestInSubset
} from '@/libs/pixsaur-color/src/metric/find-closest'
