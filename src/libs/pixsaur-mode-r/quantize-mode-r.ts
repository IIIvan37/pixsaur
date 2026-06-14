/**
 * Mode R Quantization
 *
 * Mode R creates doubled horizontal resolution by:
 * 1. Extracting alternate source pixels into two images A and B
 * 2. Displaying A and B at 50Hz with horizontal sub-pixel shifts
 * 3. The eye perceives the blend of overlapping pixels
 *
 * Input: High-resolution image (2× horizontal resolution, e.g., 320×200)
 * Output: Two index buffers at Mode 0 resolution (160×200)
 *
 * Extraction pattern (alternates line by line):
 *   Even lines: A gets even pixels (0,2,4...), B gets odd pixels (1,3,5...)
 *   Odd lines:  A gets odd pixels (1,3,5...), B gets even pixels (0,2,4...)
 *
 * Display with CRTC shifts:
 *   Even lines: A at offset 0, B at offset +1 sub-pixel
 *   Odd lines:  A at offset +1 sub-pixel, B at offset 0
 *
 * Perceived result (for line 0, source pixels 0,1,2,3):
 *   A = [0, 2], B = [1, 3]
 *   Position 0: A[0] only (border)
 *   Position 1: blend(A[0], B[0]) = blend(src0, src1)
 *   Position 2: blend(B[0], A[1]) = blend(src1, src2)
 *   Position 3: blend(A[1], B[1]) = blend(src2, src3)
 *   Position 4: B[1] only (border)
 */

import { logger } from '@/core/logger'
import type { DitheringMode } from '@/libs/pixsaur-color/src'
import { getBlueNoiseThresholdRGB } from '@/libs/pixsaur-color/src/map/blue-noise-texture'
import { getOstromoukhovCoefficients } from '@/libs/pixsaur-color/src/map/ostromoukhov-coefficients'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { calculateLuminance, colorDistance } from './blend'
import { getModeRGPUQuantizer } from './gpu-quantizer'
import { optimizeModeRPalettes } from './pair-optimizer'
import type {
  ModeRConfig,
  ModeRPalettes,
  ModeRQuantizationResult
} from './types'
import { DEFAULT_MODE_R_CONFIG } from './types'

// ============================================================================
// Dithering Matrices and Types
// ============================================================================

/** Ordered dithering matrix definition */
interface DitheringMatrix {
  size: number
  matrix: number[][]
  maxValue: number
}

/** Dithering matrices for ordered dithering methods */
const DITHERING_MATRICES: Record<string, DitheringMatrix> = {
  bayer2x2: {
    size: 2,
    maxValue: 4, // size * size
    matrix: [
      [0, 2],
      [3, 1]
    ]
  },
  bayer4x4: {
    size: 4,
    maxValue: 16, // size * size
    matrix: [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ]
  },
  bayer8x8: {
    size: 8,
    maxValue: 64, // size * size
    matrix: [
      [0, 32, 8, 40, 2, 34, 10, 42],
      [48, 16, 56, 24, 50, 18, 58, 26],
      [12, 44, 4, 36, 14, 46, 6, 38],
      [60, 28, 52, 20, 62, 30, 54, 22],
      [3, 35, 11, 43, 1, 33, 9, 41],
      [51, 19, 59, 27, 49, 17, 57, 25],
      [15, 47, 7, 39, 13, 45, 5, 37],
      [63, 31, 55, 23, 61, 29, 53, 21]
    ]
  },
  halftone4x4: {
    size: 4,
    maxValue: 16, // size * size for consistency
    matrix: [
      [7, 13, 11, 4],
      [12, 16, 14, 8],
      [10, 15, 6, 2],
      [5, 9, 3, 1]
    ]
  }
}

/** Error diffusion modes */
const ERROR_DIFFUSION_MODES = new Set<DitheringMode>([
  'floydSteinberg',
  'atkinson',
  'ylioluma1',
  'ylioluma2',
  'ostromoukhov'
])

/** Check if a dithering mode uses error diffusion */
function isErrorDiffusionMode(mode: DitheringMode | 'none'): boolean {
  return mode !== 'none' && ERROR_DIFFUSION_MODES.has(mode)
}

/** Check if a dithering mode uses ordered dithering */
function isOrderedDitheringMode(mode: DitheringMode | 'none'): boolean {
  return mode !== 'none' && mode in DITHERING_MATRICES
}

/** Check if a dithering mode uses blue noise */
function isBlueNoiseMode(mode: DitheringMode | 'none'): boolean {
  return mode === 'blueNoise'
}

/**
 * Compute bounding box of a combined set of palettes (A + B).
 * Used for diffusion correction to clamp accumulated pixels to the gamut.
 */
function computeCombinedPaletteBounds(
  paletteA: Array<Vector<'RGB'>>,
  paletteB: Array<Vector<'RGB'>>
): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [255, 255, 255]
  const max: [number, number, number] = [0, 0, 0]
  for (const c of [...paletteA, ...paletteB]) {
    if (c[0] < min[0]) min[0] = c[0]
    if (c[1] < min[1]) min[1] = c[1]
    if (c[2] < min[2]) min[2] = c[2]
    if (c[0] > max[0]) max[0] = c[0]
    if (c[1] > max[1]) max[1] = c[1]
    if (c[2] > max[2]) max[2] = c[2]
  }
  return { min, max }
}

/**
 * Get Blue Noise thresholds for a pixel position (decorrelated per RGB channel).
 * @param scale - Pre-computed amplitude (intensity × adaptive factor × 255)
 */
function getBlueNoiseThresholds(
  x: number,
  y: number,
  scale: number
): [number, number, number] {
  const [tR, tG, tB] = getBlueNoiseThresholdRGB(x, y)
  return [tR * scale, tG * scale, tB * scale]
}

/**
 * Get ordered dithering threshold for a pixel position.
 * @param amplitude - Pre-computed amplitude (intensity × adaptive factor, already scaled to [0,255] range)
 */
function getOrderedThreshold(
  x: number,
  y: number,
  matrix: DitheringMatrix,
  amplitude: number
): number {
  const mx = x % matrix.size
  const my = y % matrix.size
  const bayerVal = matrix.matrix[my][mx]
  return (bayerVal / matrix.maxValue - 0.5) * amplitude
}

/**
 * Find the best color index in a palette for a target color
 */
function findBestColorIndex(
  targetColor: Vector<'RGB'>,
  palette: Array<Vector<'RGB'>>
): { index: number; error: number } {
  let bestIndex = 0
  let bestError = Number.POSITIVE_INFINITY

  for (let i = 0; i < palette.length; i++) {
    const error = colorDistance(targetColor, palette[i])
    if (error < bestError) {
      bestError = error
      bestIndex = i
    }
  }

  return { index: bestIndex, error: bestError }
}

/**
 * Result of color extraction with frequency weights
 */
interface ExtractedColors {
  colors: Vector<'RGB'>[]
  weights: number[]
}

/**
 * Extract representative colors from an image using k-means-like sampling
 * Returns colors that represent the actual image content with their frequency weights
 */
function extractImageColors(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors: number
): ExtractedColors {
  // Sample colors from the image
  const colorCounts = new Map<string, { color: Vector<'RGB'>; count: number }>()
  const totalPixels = width * height

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    const r = imageData[idx]
    const g = imageData[idx + 1]
    const b = imageData[idx + 2]

    // Quantize to reduce unique colors (8 levels per channel = 512 buckets)
    const qr = Math.floor(r / 32) * 32
    const qg = Math.floor(g / 32) * 32
    const qb = Math.floor(b / 32) * 32
    const key = `${qr},${qg},${qb}`

    const existing = colorCounts.get(key)
    if (existing) {
      existing.count++
      // Average the actual colors
      existing.color[0] =
        (existing.color[0] * (existing.count - 1) + r) / existing.count
      existing.color[1] =
        (existing.color[1] * (existing.count - 1) + g) / existing.count
      existing.color[2] =
        (existing.color[2] * (existing.count - 1) + b) / existing.count
    } else {
      colorCounts.set(key, { color: [r, g, b], count: 1 })
    }
  }

  // Sort by frequency and take top colors
  const sorted = [...colorCounts.values()].sort((a, b) => b.count - a.count)
  const topColors = sorted.slice(0, maxColors)

  // Normalize weights (sum to 1)
  const totalCount = topColors.reduce((sum, entry) => sum + entry.count, 0)

  return {
    colors: topColors.map((entry) => [
      Math.round(entry.color[0]),
      Math.round(entry.color[1]),
      Math.round(entry.color[2])
    ]),
    weights: topColors.map((entry) => entry.count / totalCount)
  }
}

/**
 * Quantize an image to Mode R format
 *
 * For each output position x, we:
 * 1. Extract two adjacent source pixels (based on line parity)
 * 2. Quantize each to its respective palette (A or B)
 * 3. Use anti-flicker weighting to prefer low-contrast pairs when possible
 *
 * @param imageData - Source image RGBA data at doubled horizontal resolution (e.g., 320×200)
 * @param width - Source image width (doubled Mode 0 width, e.g., 320)
 * @param height - Source image height (e.g., 200)
 * @param config - Mode R configuration
 * @param existingPalette - Optional pre-optimized palette from standard mode (preserves important colors)
 * @returns Mode R quantization result with two index buffers
 */
export function quantizeModeR(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  config: ModeRConfig = DEFAULT_MODE_R_CONFIG,
  existingPalette?: Vector<'RGB'>[]
): ModeRQuantizationResult {
  // Extract image colors with frequency weights (48 is enough for good coverage)
  const { colors: targetColors, weights: targetWeights } = extractImageColors(
    imageData,
    width,
    height,
    48
  )

  // Use palette optimization for Mode R - creates 2 independent palettes
  const palettes = optimizeModeRPalettes(
    targetColors,
    targetWeights,
    config,
    existingPalette
  )

  // Output dimensions (half the horizontal resolution)
  const outWidth = Math.floor(width / 2)
  const outHeight = height

  // Setup dithering based on mode
  const ditheringMode = config.ditheringMode
  const ditherIntensity = config.ditheringIntensity / 100
  const useErrorDiffusion =
    isErrorDiffusionMode(ditheringMode) && ditherIntensity > 0
  const useOrderedDithering =
    isOrderedDitheringMode(ditheringMode) && ditherIntensity > 0
  const useBlueNoise = isBlueNoiseMode(ditheringMode) && ditherIntensity > 0

  const useDiffusionCorrection = config.useDiffusionCorrection ?? true
  const useOrderedCorrection = config.useOrderedCorrection ?? true
  const ERROR_CLAMP = 64

  // Combined palette bounds (for diffusion clamping and ordered skip)
  const paletteBounds = computeCombinedPaletteBounds(
    palettes.paletteA,
    palettes.paletteB
  )

  // Adaptive amplitude for ordered modes: larger palette → less noise needed
  const paletteSize = palettes.paletteA.length
  const orderedAmplitude = useOrderedCorrection
    ? ditherIntensity * (255 / Math.sqrt(paletteSize))
    : ditherIntensity * 255

  // Try GPU quantization for non-dithering modes (much faster)
  // Error diffusion requires sequential processing, so it must stay on CPU
  const canUseGPU = ditheringMode === 'none' || ditherIntensity === 0
  if (canUseGPU) {
    const gpuQuantizer = getModeRGPUQuantizer()
    if (gpuQuantizer?.isAvailable()) {
      logger.info('[Mode R] Using GPU quantization')
      const gpuResult = gpuQuantizer.quantize(
        imageData,
        width,
        height,
        palettes,
        config.antiFlickerWeight,
        config.maxLuminanceDelta
      )
      if (gpuResult) {
        // Count unique blends used
        const usedBlends = new Set<string>()
        for (let i = 0; i < gpuResult.indexBufferA.length; i++) {
          usedBlends.add(
            `${gpuResult.indexBufferA[i]},${gpuResult.indexBufferB[i]}`
          )
        }
        logger.info('[Mode R] GPU quantization complete', {
          blendsUsed: usedBlends.size
        })
        return {
          indexBufferA: gpuResult.indexBufferA,
          indexBufferB: gpuResult.indexBufferB,
          palettes,
          totalError: 0 // GPU doesn't track error
        }
      }
      logger.warn('[Mode R] GPU quantization failed, falling back to CPU')
    }
  }

  // Error buffer for error diffusion modes
  const errorBuffer = useErrorDiffusion
    ? new Float32Array(width * height * 3)
    : null

  // Get dithering matrix for ordered modes
  const ditherMatrix = useOrderedDithering
    ? DITHERING_MATRICES[ditheringMode as string]
    : null

  logger.info('[Mode R] Starting CPU quantization with dithering', {
    mode: ditheringMode,
    intensity: config.ditheringIntensity,
    useErrorDiffusion,
    useOrderedDithering,
    useBlueNoise
  })

  // PERFORMANCE: Build lookup table ONCE for fast pair finding
  const lookupTable = buildBlendLookupTable(palettes)
  const flickerWeight = config.antiFlickerWeight / 100

  logger.info('[Mode R] Built blend lookup table', {
    totalBlends: lookupTable.allBlends.length,
    uniformPairs: lookupTable.uniformPairs.length,
    spatialBuckets: lookupTable.spatialIndex.size
  })

  // Create two index buffers
  const indexBufferA = new Uint8Array(outWidth * outHeight)
  const indexBufferB = new Uint8Array(outWidth * outHeight)
  let totalError = 0

  // Process each output pixel
  for (let y = 0; y < outHeight; y++) {
    const isEvenLine = y % 2 === 0

    for (let x = 0; x < outWidth; x++) {
      // Determine which source pixels go to A and B based on line parity
      // Even lines: A gets even pixels (2x), B gets odd pixels (2x+1)
      // Odd lines: A gets odd pixels (2x+1), B gets even pixels (2x)
      const srcXA = isEvenLine ? x * 2 : x * 2 + 1
      const srcXB = isEvenLine ? x * 2 + 1 : x * 2

      // Get source colors with dithering applied
      let colorA: Vector<'RGB'>
      let colorB: Vector<'RGB'>

      if (useOrderedDithering && ditherMatrix) {
        // Ordered dithering: apply threshold-based color adjustment
        // Use OUTPUT coordinates (x, y) for the dithering pattern, not source coordinates
        // This ensures the pattern is consistent at CPC resolution
        const threshold = getOrderedThreshold(
          x,
          y,
          ditherMatrix,
          orderedAmplitude
        )

        colorA = getSourceColorWithThreshold(
          imageData,
          width,
          srcXA,
          y,
          threshold,
          useOrderedCorrection ? paletteBounds : null
        )
        colorB = getSourceColorWithThreshold(
          imageData,
          width,
          srcXB,
          y,
          threshold,
          useOrderedCorrection ? paletteBounds : null
        )
      } else if (useBlueNoise) {
        // Blue Noise dithering: apply per-channel threshold-based color adjustment
        // Use OUTPUT coordinates (x, y) for the dithering pattern
        const thresholds = getBlueNoiseThresholds(x, y, orderedAmplitude)

        colorA = getSourceColorWithRGBThresholds(
          imageData,
          width,
          srcXA,
          y,
          thresholds,
          useOrderedCorrection ? paletteBounds : null
        )
        colorB = getSourceColorWithRGBThresholds(
          imageData,
          width,
          srcXB,
          y,
          thresholds,
          useOrderedCorrection ? paletteBounds : null
        )
      } else {
        // Error diffusion or no dithering: use error buffer
        colorA = getSourceColorWithError(
          imageData,
          errorBuffer,
          width,
          srcXA,
          y,
          useDiffusionCorrection ? paletteBounds : null
        )
        colorB = getSourceColorWithError(
          imageData,
          errorBuffer,
          width,
          srcXB,
          y,
          useDiffusionCorrection ? paletteBounds : null
        )
      }

      // PERFORMANCE: Use fast lookup instead of exhaustive search
      // Target color is the perceived blend (average of colorA and colorB)
      const targetColor: Vector<'RGB'> = [
        Math.round((colorA[0] + colorB[0]) / 2),
        Math.round((colorA[1] + colorB[1]) / 2),
        Math.round((colorA[2] + colorB[2]) / 2)
      ]
      const isUniformArea = areColorsSimilar(colorA, colorB)

      const result = findBestIndicesFast(
        targetColor,
        isUniformArea,
        lookupTable,
        flickerWeight,
        config.maxLuminanceDelta
      )

      const outIdx = y * outWidth + x
      indexBufferA[outIdx] = result.indexA
      indexBufferB[outIdx] = result.indexB
      totalError += result.error

      // Propagate dithering errors for error diffusion modes
      // IMPORTANT: Error is based on the PERCEIVED (blended) color, not individual colors
      if (errorBuffer && useErrorDiffusion) {
        const chosenA = palettes.paletteA[result.indexA]
        const chosenB = palettes.paletteB[result.indexB]

        // Calculate the perceived blended color that will be displayed
        const blendedChosen: Vector<'RGB'> = [
          Math.round((chosenA[0] + chosenB[0]) / 2),
          Math.round((chosenA[1] + chosenB[1]) / 2),
          Math.round((chosenA[2] + chosenB[2]) / 2)
        ]

        // Error is the difference between target and perceived blend
        const blendError: Vector<'RGB'> = [
          (targetColor[0] - blendedChosen[0]) * ditherIntensity,
          (targetColor[1] - blendedChosen[1]) * ditherIntensity,
          (targetColor[2] - blendedChosen[2]) * ditherIntensity
        ]

        // Distribute error equally to both source pixel positions
        const errorA: Vector<'RGB'> = [
          blendError[0] / 2,
          blendError[1] / 2,
          blendError[2] / 2
        ]
        const errorB: Vector<'RGB'> = [
          blendError[0] / 2,
          blendError[1] / 2,
          blendError[2] / 2
        ]

        // Calculate intensity (luminance) for Ostromoukhov coefficients
        const intensityA =
          0.299 * colorA[0] + 0.587 * colorA[1] + 0.114 * colorA[2]
        const intensityB =
          0.299 * colorB[0] + 0.587 * colorB[1] + 0.114 * colorB[2]

        // Use appropriate error diffusion based on mode
        propagateError({
          errorBuffer,
          width,
          height,
          x: srcXA,
          y,
          error: errorA,
          mode: ditheringMode,
          originalIntensity: intensityA,
          errorClamp: useDiffusionCorrection ? ERROR_CLAMP : undefined
        })
        propagateError({
          errorBuffer,
          width,
          height,
          x: srcXB,
          y,
          error: errorB,
          mode: ditheringMode,
          originalIntensity: intensityB,
          errorClamp: useDiffusionCorrection ? ERROR_CLAMP : undefined
        })
      }
    }
  }

  // Count unique blends actually used
  const usedBlends = new Set<string>()
  for (let i = 0; i < indexBufferA.length; i++) {
    usedBlends.add(`${indexBufferA[i]},${indexBufferB[i]}`)
  }

  logger.info('[Mode R] Quantization complete:', {
    imageSize: `${width}×${height}`,
    outputSize: `${outWidth}×${outHeight}`,
    ditheringMode: ditheringMode,
    possibleBlends: palettes.stats.uniquePerceivedColors,
    actualBlendsUsed: usedBlends.size,
    totalError: Math.round(totalError)
  })

  return { indexBufferA, indexBufferB, palettes, totalError }
}

/**
 * Get source pixel color with accumulated dithering error (for error diffusion).
 * When bounds are provided, clamps the result to the combined palette gamut.
 */
function getSourceColorWithError(
  imageData: Uint8ClampedArray,
  errorBuffer: Float32Array | null,
  width: number,
  x: number,
  y: number,
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
  } | null = null
): Vector<'RGB'> {
  const pixelIdx = (y * width + x) * 4
  const r = imageData[pixelIdx]
  const g = imageData[pixelIdx + 1]
  const b = imageData[pixelIdx + 2]

  if (!errorBuffer) return [r, g, b]

  const errorIdx = (y * width + x) * 3
  const pr = r + errorBuffer[errorIdx]
  const pg = g + errorBuffer[errorIdx + 1]
  const pb = b + errorBuffer[errorIdx + 2]

  if (bounds) {
    return [
      Math.max(bounds.min[0], Math.min(bounds.max[0], pr)),
      Math.max(bounds.min[1], Math.min(bounds.max[1], pg)),
      Math.max(bounds.min[2], Math.min(bounds.max[2], pb))
    ]
  }
  return [
    Math.max(0, Math.min(255, pr)),
    Math.max(0, Math.min(255, pg)),
    Math.max(0, Math.min(255, pb))
  ]
}

/**
 * Get source pixel color with ordered dithering applied.
 * When bounds are provided, skips perturbation if the pixel already exactly
 * matches a palette color (skip-on-exact-match).
 */
function getSourceColorWithThreshold(
  imageData: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  threshold: number,
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
  } | null = null
): Vector<'RGB'> {
  const pixelIdx = (y * width + x) * 4
  const r = imageData[pixelIdx]
  const g = imageData[pixelIdx + 1]
  const b = imageData[pixelIdx + 2]

  // Skip perturbation when the pixel is already on the palette gamut boundary
  // (heuristic for exact match: all channels within 1 unit of a boundary)
  if (bounds) {
    const onBoundR = r <= bounds.min[0] + 1 || r >= bounds.max[0] - 1
    const onBoundG = g <= bounds.min[1] + 1 || g >= bounds.max[1] - 1
    const onBoundB = b <= bounds.min[2] + 1 || b >= bounds.max[2] - 1
    if (onBoundR && onBoundG && onBoundB) return [r, g, b]
  }

  return [
    Math.max(0, Math.min(255, r + threshold)),
    Math.max(0, Math.min(255, g + threshold)),
    Math.max(0, Math.min(255, b + threshold))
  ]
}

/**
 * Get source pixel color with per-channel RGB thresholds applied.
 * Used for decorrelated blue noise dithering.
 * When bounds are provided, skips perturbation if the pixel is at gamut boundary.
 */
function getSourceColorWithRGBThresholds(
  imageData: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  thresholds: [number, number, number],
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
  } | null = null
): Vector<'RGB'> {
  const pixelIdx = (y * width + x) * 4
  const r = imageData[pixelIdx]
  const g = imageData[pixelIdx + 1]
  const b = imageData[pixelIdx + 2]

  if (bounds) {
    const onBoundR = r <= bounds.min[0] + 1 || r >= bounds.max[0] - 1
    const onBoundG = g <= bounds.min[1] + 1 || g >= bounds.max[1] - 1
    const onBoundB = b <= bounds.min[2] + 1 || b >= bounds.max[2] - 1
    if (onBoundR && onBoundG && onBoundB) return [r, g, b]
  }

  return [
    Math.max(0, Math.min(255, r + thresholds[0])),
    Math.max(0, Math.min(255, g + thresholds[1])),
    Math.max(0, Math.min(255, b + thresholds[2]))
  ]
}

/**
 * Check if two colors are very similar (used to detect margin areas)
 * Margin areas should use uniform pairs to avoid flicker
 */
function areColorsSimilar(
  colorA: Vector<'RGB'>,
  colorB: Vector<'RGB'>,
  threshold = 10
): boolean {
  return (
    Math.abs(colorA[0] - colorB[0]) <= threshold &&
    Math.abs(colorA[1] - colorB[1]) <= threshold &&
    Math.abs(colorA[2] - colorB[2]) <= threshold
  )
}

// ============================================================================
// PERFORMANCE OPTIMIZATION: Pre-computed Blend Lookup Table
// ============================================================================

/**
 * Pre-computed pair entry for fast lookup
 */
interface BlendEntry {
  indexA: number
  indexB: number
  blendedColor: Vector<'RGB'>
  flickerScore: number // Pre-computed luminance delta
}

/**
 * Lookup table for fast pair finding
 * Uses spatial hashing with 8 levels per channel (512 buckets)
 */
interface BlendLookupTable {
  /** All 256 possible blends, sorted by flicker (lowest first) */
  allBlends: BlendEntry[]
  /** Uniform pairs (where paletteA[i] ≈ paletteB[j]), for margin areas */
  uniformPairs: BlendEntry[]
  /** Spatial index: bucket -> indices into allBlends, sorted by proximity */
  spatialIndex: Map<number, number[]>
}

/**
 * Compute spatial bucket key from RGB color (8 levels per channel = 512 buckets)
 */
function getSpatialKey(r: number, g: number, b: number): number {
  const qr = Math.floor(r / 32) // 0-7
  const qg = Math.floor(g / 32) // 0-7
  const qb = Math.floor(b / 32) // 0-7
  return qr * 64 + qg * 8 + qb
}

/**
 * Pre-compute all 256 blend combinations for fast lookup
 * This is called ONCE per quantization, not per pixel
 */
function buildBlendLookupTable(palettes: ModeRPalettes): BlendLookupTable {
  const allBlends: BlendEntry[] = []
  const uniformPairs: BlendEntry[] = []

  // Generate all 256 combinations
  for (let a = 0; a < palettes.paletteA.length; a++) {
    const palA = palettes.paletteA[a]
    for (let b = 0; b < palettes.paletteB.length; b++) {
      const palB = palettes.paletteB[b]

      // Blended color (what the eye perceives)
      const blendedColor: Vector<'RGB'> = [
        Math.round((palA[0] + palB[0]) / 2),
        Math.round((palA[1] + palB[1]) / 2),
        Math.round((palA[2] + palB[2]) / 2)
      ]

      // Flicker score (luminance difference)
      const lumA = 0.299 * palA[0] + 0.587 * palA[1] + 0.114 * palA[2]
      const lumB = 0.299 * palB[0] + 0.587 * palB[1] + 0.114 * palB[2]
      const flickerScore = Math.abs(lumA - lumB)

      const entry: BlendEntry = {
        indexA: a,
        indexB: b,
        blendedColor,
        flickerScore
      }

      allBlends.push(entry)

      // Track uniform pairs (distance < 50, ~7 per channel)
      const pairDistance = colorDistance(palA, palB)
      if (pairDistance < 50) {
        uniformPairs.push(entry)
      }
    }
  }

  // Sort allBlends by flicker (lowest first) for tie-breaking
  allBlends.sort((a, b) => a.flickerScore - b.flickerScore)

  // Build spatial index: for each bucket, store blend indices sorted by distance to bucket center
  const spatialIndex = new Map<number, number[]>()

  for (let bucket = 0; bucket < 512; bucket++) {
    // Bucket center color
    const centerR = ((bucket >> 6) & 7) * 32 + 16
    const centerG = ((bucket >> 3) & 7) * 32 + 16
    const centerB = (bucket & 7) * 32 + 16

    // Sort blend indices by distance to bucket center
    const indices = allBlends
      .map((blend, idx) => ({
        idx,
        dist:
          Math.abs(blend.blendedColor[0] - centerR) +
          Math.abs(blend.blendedColor[1] - centerG) +
          Math.abs(blend.blendedColor[2] - centerB)
      }))
      .sort((a, b) => a.dist - b.dist)
      .map((x) => x.idx)

    spatialIndex.set(bucket, indices)
  }

  return { allBlends, uniformPairs, spatialIndex }
}

/**
 * Fast pair finding using pre-computed lookup table
 * Searches the most promising candidates in the spatial bucket
 *
 * IMPORTANT: We always search all 256 blends to find the best visual match.
 * The spatial index helps by ordering candidates by proximity, so we can
 * often find a good match early and use early termination.
 */
function findBestIndicesFast(
  targetColor: Vector<'RGB'>,
  _isUniformArea: boolean, // No longer used - always search all blends for best visual result
  lookupTable: BlendLookupTable,
  flickerWeight: number,
  maxLuminanceDelta: number
): { indexA: number; indexB: number; error: number } {
  // Get spatial bucket for target color
  const bucket = getSpatialKey(targetColor[0], targetColor[1], targetColor[2])
  const candidates = lookupTable.spatialIndex.get(bucket)!

  // Search more candidates to find better blends
  // With 256 total blends, searching 64-128 gives good coverage while staying fast
  const MAX_CANDIDATES = 128

  let bestEntry = lookupTable.allBlends[candidates[0]]
  let bestCost = Number.POSITIVE_INFINITY

  for (let i = 0; i < Math.min(MAX_CANDIDATES, candidates.length); i++) {
    const entry = lookupTable.allBlends[candidates[i]]

    // Color matching error (Manhattan distance - faster than Euclidean)
    const colorError =
      Math.abs(targetColor[0] - entry.blendedColor[0]) +
      Math.abs(targetColor[1] - entry.blendedColor[1]) +
      Math.abs(targetColor[2] - entry.blendedColor[2])

    // Flicker penalty
    const deltaPenalty =
      entry.flickerScore > maxLuminanceDelta
        ? (entry.flickerScore - maxLuminanceDelta) * 5
        : 0
    const flickerCost = entry.flickerScore * flickerWeight

    const totalCost = colorError + flickerCost + deltaPenalty

    if (totalCost < bestCost) {
      bestCost = totalCost
      bestEntry = entry
    }
  }

  return {
    indexA: bestEntry.indexA,
    indexB: bestEntry.indexB,
    error: bestCost
  }
}

/**
 * Error diffusion distributions for different algorithms
 */
const ERROR_DIFFUSION_KERNELS: Record<
  string,
  Array<{ dx: number; dy: number; factor: number }>
> = {
  floydSteinberg: [
    // Floyd-Steinberg:    * 7/16
    //                 3/16 5/16 1/16
    { dx: 1, dy: 0, factor: 7 / 16 },
    { dx: -1, dy: 1, factor: 3 / 16 },
    { dx: 0, dy: 1, factor: 5 / 16 },
    { dx: 1, dy: 1, factor: 1 / 16 }
  ],
  atkinson: [
    // Atkinson:       * 1/8 1/8
    //             1/8 1/8 1/8
    //                 1/8
    { dx: 1, dy: 0, factor: 1 / 8 },
    { dx: 2, dy: 0, factor: 1 / 8 },
    { dx: -1, dy: 1, factor: 1 / 8 },
    { dx: 0, dy: 1, factor: 1 / 8 },
    { dx: 1, dy: 1, factor: 1 / 8 },
    { dx: 0, dy: 2, factor: 1 / 8 }
  ],
  ylioluma1: [
    // Yliluoma 1 (similar to Sierra Lite)
    //           * 2/4
    //         1/4 1/4
    { dx: 1, dy: 0, factor: 2 / 4 },
    { dx: -1, dy: 1, factor: 1 / 4 },
    { dx: 0, dy: 1, factor: 1 / 4 }
  ],
  ylioluma2: [
    // Yliluoma 2 (similar to Jarvis-Judice-Ninke simplified)
    //               * 7/48 5/48
    //         3/48 5/48 7/48 5/48 3/48
    //         1/48 3/48 5/48 3/48 1/48
    { dx: 1, dy: 0, factor: 7 / 48 },
    { dx: 2, dy: 0, factor: 5 / 48 },
    { dx: -2, dy: 1, factor: 3 / 48 },
    { dx: -1, dy: 1, factor: 5 / 48 },
    { dx: 0, dy: 1, factor: 7 / 48 },
    { dx: 1, dy: 1, factor: 5 / 48 },
    { dx: 2, dy: 1, factor: 3 / 48 },
    { dx: -2, dy: 2, factor: 1 / 48 },
    { dx: -1, dy: 2, factor: 3 / 48 },
    { dx: 0, dy: 2, factor: 5 / 48 },
    { dx: 1, dy: 2, factor: 3 / 48 },
    { dx: 2, dy: 2, factor: 1 / 48 }
  ]
}

/** Options for error propagation */
interface PropagateErrorOptions {
  errorBuffer: Float32Array
  width: number
  height: number
  x: number
  y: number
  error: Vector<'RGB'>
  mode: DitheringMode | 'none'
  originalIntensity?: number
  /** When set, clamps each error component to ±errorClamp before adding */
  errorClamp?: number
}

/**
 * Propagate quantization error to neighboring pixels using the specified algorithm
 */
function propagateError(opts: PropagateErrorOptions): void {
  const {
    errorBuffer,
    width,
    height,
    x,
    y,
    error,
    mode,
    originalIntensity,
    errorClamp
  } = opts

  const clamp = (v: number) =>
    errorClamp === undefined
      ? v
      : Math.max(-errorClamp, Math.min(errorClamp, v))
  const e0 = clamp(error[0])
  const e1 = clamp(error[1])
  const e2 = clamp(error[2])

  // Ostromoukhov uses variable coefficients based on intensity
  if (mode === 'ostromoukhov' && originalIntensity !== undefined) {
    const [right, downLeft, down] =
      getOstromoukhovCoefficients(originalIntensity)
    const ostroKernel = [
      { dx: 1, dy: 0, factor: right },
      { dx: -1, dy: 1, factor: downLeft },
      { dx: 0, dy: 1, factor: down }
    ]
    for (const { dx, dy, factor } of ostroKernel) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = (ny * width + nx) * 3
        errorBuffer[idx] += e0 * factor
        errorBuffer[idx + 1] += e1 * factor
        errorBuffer[idx + 2] += e2 * factor
      }
    }
    return
  }

  const kernel =
    ERROR_DIFFUSION_KERNELS[mode as string] ??
    ERROR_DIFFUSION_KERNELS.floydSteinberg

  for (const { dx, dy, factor } of kernel) {
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const idx = (ny * width + nx) * 3
      errorBuffer[idx] += e0 * factor
      errorBuffer[idx + 1] += e1 * factor
      errorBuffer[idx + 2] += e2 * factor
    }
  }
}

/**
 * Generate a preview image showing the perceived result at doubled resolution
 * Reconstructs the full resolution image from the two interlaced buffers
 *
 * @param indexBufferA - Index buffer for Image A
 * @param indexBufferB - Index buffer for Image B
 * @param width - Mode 0 width (e.g., 160)
 * @param height - Image height (e.g., 200)
 * @param palettes - Mode R palettes
 * @returns RGBA image data at doubled horizontal resolution
 */
export function generateModeRPreview(
  indexBufferA: Uint8Array,
  indexBufferB: Uint8Array,
  width: number,
  height: number,
  palettes: ModeRPalettes
): Uint8ClampedArray {
  const outWidth = width * 2
  const imageData = new Uint8ClampedArray(outWidth * height * 4)

  for (let y = 0; y < height; y++) {
    const isEvenLine = y % 2 === 0

    for (let x = 0; x < width; x++) {
      const srcIdx = y * width + x

      // Get colors from both images
      const colorA = palettes.paletteA[indexBufferA[srcIdx]]
      const colorB = palettes.paletteB[indexBufferB[srcIdx]]

      // Reconstruct based on extraction pattern
      // Even lines: A has even pixels, B has odd pixels
      // Odd lines: A has odd pixels, B has even pixels
      const dstXEven = isEvenLine ? x * 2 : x * 2 + 1
      const dstXOdd = isEvenLine ? x * 2 + 1 : x * 2

      // Place color A at its original position
      const dstIdxA = (y * outWidth + dstXEven) * 4
      imageData[dstIdxA] = colorA[0]
      imageData[dstIdxA + 1] = colorA[1]
      imageData[dstIdxA + 2] = colorA[2]
      imageData[dstIdxA + 3] = 255

      // Place color B at its original position
      const dstIdxB = (y * outWidth + dstXOdd) * 4
      imageData[dstIdxB] = colorB[0]
      imageData[dstIdxB + 1] = colorB[1]
      imageData[dstIdxB + 2] = colorB[2]
      imageData[dstIdxB + 3] = 255
    }
  }

  return imageData
}

/**
 * Generate a preview showing the perceived colors at doubled resolution
 *
 * Mode R interlacing works as follows:
 * - Frame A and Frame B alternate at 50Hz
 * - Each frame displays at Mode 0 resolution (160px wide)
 * - Frame A and Frame B have alternating horizontal shifts per line:
 *   - Even lines: Frame A at position 0, Frame B at position +0.5 (half pixel)
 *   - Odd lines: Frame A at position +0.5, Frame B at position 0
 *
 * The perceived result at doubled resolution (320px) is:
 * - Even lines:
 *   - Sub-pixel 2x: blend of A[x] (centered) and B[x-1] (shifted right, so its right half)
 *   - Sub-pixel 2x+1: blend of A[x] (right half) and B[x] (centered)
 * - Odd lines:
 *   - Sub-pixel 2x: blend of A[x-1] (shifted right) and B[x] (centered)
 *   - Sub-pixel 2x+1: blend of A[x] (centered) and B[x] (right half)
 *
 * Simplified model: each output position blends the Mode 0 pixels that "cover" it.
 */
export function generateBlendedPreview(
  indexBufferA: Uint8Array,
  indexBufferB: Uint8Array,
  width: number,
  height: number,
  palettes: ModeRPalettes
): Uint8ClampedArray {
  // Output at doubled resolution for display
  const outWidth = width * 2
  const imageData = new Uint8ClampedArray(outWidth * height * 4)

  for (let y = 0; y < height; y++) {
    const isEvenLine = y % 2 === 0

    for (let outX = 0; outX < outWidth; outX++) {
      // Determine which Mode 0 pixel from each frame contributes to this output position
      // Each Mode 0 pixel spans 2 output pixels, but with different offsets per frame

      let colorA: Vector<'RGB'>
      let colorB: Vector<'RGB'>

      if (isEvenLine) {
        // Even lines: Frame A at position 0, Frame B shifted by +1 output pixel
        // Frame A pixel x covers output positions [2x, 2x+1]
        // Frame B pixel x covers output positions [2x+1, 2x+2]
        const idxA = Math.floor(outX / 2)
        const idxB = Math.floor((outX - 1) / 2)

        colorA =
          palettes.paletteA[
            indexBufferA[y * width + Math.max(0, Math.min(width - 1, idxA))]
          ]
        colorB =
          outX === 0
            ? [0, 0, 0] // Border: no B pixel covers position 0 on even lines
            : palettes.paletteB[
                indexBufferB[y * width + Math.max(0, Math.min(width - 1, idxB))]
              ]
      } else {
        // Odd lines: Frame A shifted by +1 output pixel, Frame B at position 0
        // Frame A pixel x covers output positions [2x+1, 2x+2]
        // Frame B pixel x covers output positions [2x, 2x+1]
        const idxA = Math.floor((outX - 1) / 2)
        const idxB = Math.floor(outX / 2)

        colorA =
          outX === 0
            ? [0, 0, 0] // Border: no A pixel covers position 0 on odd lines
            : palettes.paletteA[
                indexBufferA[y * width + Math.max(0, Math.min(width - 1, idxA))]
              ]
        colorB =
          palettes.paletteB[
            indexBufferB[y * width + Math.max(0, Math.min(width - 1, idxB))]
          ]
      }

      // Blend the two colors (temporal averaging at 50Hz)
      const blendedR = Math.round((colorA[0] + colorB[0]) / 2)
      const blendedG = Math.round((colorA[1] + colorB[1]) / 2)
      const blendedB = Math.round((colorA[2] + colorB[2]) / 2)

      const dstIdx = (y * outWidth + outX) * 4
      imageData[dstIdx] = blendedR
      imageData[dstIdx + 1] = blendedG
      imageData[dstIdx + 2] = blendedB
      imageData[dstIdx + 3] = 255
    }
  }

  return imageData
}

/**
 * Generate a preview image showing frame A only (at Mode 0 resolution)
 */
export function generateFrameAPreview(
  indexBufferA: Uint8Array,
  width: number,
  height: number,
  palettes: ModeRPalettes
): Uint8ClampedArray {
  const imageData = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < indexBufferA.length; i++) {
    const color = palettes.paletteA[indexBufferA[i]]

    const pixelIdx = i * 4
    imageData[pixelIdx] = color[0]
    imageData[pixelIdx + 1] = color[1]
    imageData[pixelIdx + 2] = color[2]
    imageData[pixelIdx + 3] = 255
  }

  return imageData
}

/**
 * Generate a preview image showing frame B only (at Mode 0 resolution)
 */
export function generateFrameBPreview(
  indexBufferB: Uint8Array,
  width: number,
  height: number,
  palettes: ModeRPalettes
): Uint8ClampedArray {
  const imageData = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < indexBufferB.length; i++) {
    const color = palettes.paletteB[indexBufferB[i]]

    const pixelIdx = i * 4
    imageData[pixelIdx] = color[0]
    imageData[pixelIdx + 1] = color[1]
    imageData[pixelIdx + 2] = color[2]
    imageData[pixelIdx + 3] = 255
  }

  return imageData
}

/**
 * Generate a flicker heatmap (debug view)
 * Shows where flicker will be most visible based on luminance differences
 * White = high flicker, black = no flicker
 */
export function generateFlickerHeatmap(
  indexBufferA: Uint8Array,
  indexBufferB: Uint8Array,
  width: number,
  height: number,
  palettes: ModeRPalettes
): Uint8ClampedArray {
  const imageData = new Uint8ClampedArray(width * height * 4)

  // Find max flicker for normalization
  let maxFlicker = 0
  for (let i = 0; i < indexBufferA.length; i++) {
    const lumA = calculateLuminance(palettes.paletteA[indexBufferA[i]])
    const lumB = calculateLuminance(palettes.paletteB[indexBufferB[i]])
    const flicker = Math.abs(lumA - lumB)
    if (flicker > maxFlicker) maxFlicker = flicker
  }
  if (maxFlicker === 0) maxFlicker = 1

  for (let i = 0; i < indexBufferA.length; i++) {
    const lumA = calculateLuminance(palettes.paletteA[indexBufferA[i]])
    const lumB = calculateLuminance(palettes.paletteB[indexBufferB[i]])
    const flicker = Math.abs(lumA - lumB)
    const intensity = Math.round((flicker / maxFlicker) * 255)

    const pixelIdx = i * 4
    imageData[pixelIdx] = intensity
    imageData[pixelIdx + 1] = intensity
    imageData[pixelIdx + 2] = intensity
    imageData[pixelIdx + 3] = 255
  }

  return imageData
}

/**
 * Quantize an image using Mode R with dithering support
 *
 * @param imageData - Source image RGBA data at doubled horizontal resolution
 * @param width - Source image width (doubled Mode 0 width)
 * @param height - Image height
 * @param targetPalette - Pre-quantized 16-color palette
 * @param config - Mode R configuration
 * @param ditheringStrength - Dithering strength (0-1)
 * @returns Mode R quantization result
 */
export function quantizeModeRWithDithering(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  targetPalette: Vector<'RGB'>[],
  config: ModeRConfig = DEFAULT_MODE_R_CONFIG,
  ditheringStrength = 1
): ModeRQuantizationResult {
  // Extract colors from image for palette B optimization
  const { colors: imageColors, weights: imageWeights } = extractImageColors(
    imageData,
    width,
    height,
    64
  )

  const palettes = optimizeModeRPalettes(
    imageColors,
    imageWeights,
    config,
    targetPalette
  )

  const outWidth = Math.floor(width / 2)
  const outHeight = height

  const { errorBufferA, errorBufferB } = extractInterlacedPixels(
    imageData,
    width,
    outWidth,
    outHeight
  )

  const indexBufferA = quantizeWithDithering(
    errorBufferA,
    outWidth,
    outHeight,
    palettes.paletteA,
    ditheringStrength
  )

  const indexBufferB = quantizeWithDithering(
    errorBufferB,
    outWidth,
    outHeight,
    palettes.paletteB,
    ditheringStrength
  )

  const totalError = calculateTotalError(
    imageData,
    width,
    outWidth,
    outHeight,
    indexBufferA,
    indexBufferB,
    palettes
  )

  return {
    indexBufferA,
    indexBufferB,
    palettes,
    totalError
  }
}

/**
 * Extract pixels from source according to line-by-line interlaced pattern
 */
function extractInterlacedPixels(
  imageData: Uint8ClampedArray,
  width: number,
  outWidth: number,
  outHeight: number
): { errorBufferA: Float32Array; errorBufferB: Float32Array } {
  const errorBufferA = new Float32Array(outWidth * outHeight * 3)
  const errorBufferB = new Float32Array(outWidth * outHeight * 3)

  for (let y = 0; y < outHeight; y++) {
    const isEvenLine = y % 2 === 0

    for (let x = 0; x < outWidth; x++) {
      const outIdx = y * outWidth + x

      const srcXA = isEvenLine ? x * 2 : x * 2 + 1
      const srcXB = isEvenLine ? x * 2 + 1 : x * 2

      const srcIdxA = (y * width + srcXA) * 4
      errorBufferA[outIdx * 3] = imageData[srcIdxA]
      errorBufferA[outIdx * 3 + 1] = imageData[srcIdxA + 1]
      errorBufferA[outIdx * 3 + 2] = imageData[srcIdxA + 2]

      const srcIdxB = (y * width + srcXB) * 4
      errorBufferB[outIdx * 3] = imageData[srcIdxB]
      errorBufferB[outIdx * 3 + 1] = imageData[srcIdxB + 1]
      errorBufferB[outIdx * 3 + 2] = imageData[srcIdxB + 2]
    }
  }

  return { errorBufferA, errorBufferB }
}

/**
 * Calculate total quantization error
 */
function calculateTotalError(
  imageData: Uint8ClampedArray,
  width: number,
  outWidth: number,
  outHeight: number,
  indexBufferA: Uint8Array,
  indexBufferB: Uint8Array,
  palettes: ModeRPalettes
): number {
  let totalError = 0

  for (let y = 0; y < outHeight; y++) {
    const isEvenLine = y % 2 === 0

    for (let x = 0; x < outWidth; x++) {
      const outIdx = y * outWidth + x

      const srcXA = isEvenLine ? x * 2 : x * 2 + 1
      const srcXB = isEvenLine ? x * 2 + 1 : x * 2

      const srcIdxA = (y * width + srcXA) * 4
      const srcIdxB = (y * width + srcXB) * 4

      const origA: Vector<'RGB'> = [
        imageData[srcIdxA],
        imageData[srcIdxA + 1],
        imageData[srcIdxA + 2]
      ]
      const origB: Vector<'RGB'> = [
        imageData[srcIdxB],
        imageData[srcIdxB + 1],
        imageData[srcIdxB + 2]
      ]

      const colorA = palettes.paletteA[indexBufferA[outIdx]]
      const colorB = palettes.paletteB[indexBufferB[outIdx]]

      totalError += colorDistance(origA, colorA) + colorDistance(origB, colorB)
    }
  }

  return totalError
}

/**
 * Distribute Floyd-Steinberg error to neighboring pixels
 */
function distributeError(
  errorBuffer: Float32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  error: Vector<'RGB'>
): void {
  const [errR, errG, errB] = error

  if (x + 1 < width) {
    const rightIdx = y * width + (x + 1)
    errorBuffer[rightIdx * 3] += errR * (7 / 16)
    errorBuffer[rightIdx * 3 + 1] += errG * (7 / 16)
    errorBuffer[rightIdx * 3 + 2] += errB * (7 / 16)
  }

  if (y + 1 >= height) return

  if (x > 0) {
    const bottomLeftIdx = (y + 1) * width + (x - 1)
    errorBuffer[bottomLeftIdx * 3] += errR * (3 / 16)
    errorBuffer[bottomLeftIdx * 3 + 1] += errG * (3 / 16)
    errorBuffer[bottomLeftIdx * 3 + 2] += errB * (3 / 16)
  }

  const bottomIdx = (y + 1) * width + x
  errorBuffer[bottomIdx * 3] += errR * (5 / 16)
  errorBuffer[bottomIdx * 3 + 1] += errG * (5 / 16)
  errorBuffer[bottomIdx * 3 + 2] += errB * (5 / 16)

  if (x + 1 < width) {
    const bottomRightIdx = (y + 1) * width + (x + 1)
    errorBuffer[bottomRightIdx * 3] += errR * (1 / 16)
    errorBuffer[bottomRightIdx * 3 + 1] += errG * (1 / 16)
    errorBuffer[bottomRightIdx * 3 + 2] += errB * (1 / 16)
  }
}

/**
 * Internal helper: quantize a single image with Floyd-Steinberg dithering
 */
function quantizeWithDithering(
  errorBuffer: Float32Array,
  width: number,
  height: number,
  palette: Array<Vector<'RGB'>>,
  ditheringStrength: number
): Uint8Array {
  const indexBuffer = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const targetColor: Vector<'RGB'> = [
        Math.max(0, Math.min(255, Math.round(errorBuffer[idx * 3]))),
        Math.max(0, Math.min(255, Math.round(errorBuffer[idx * 3 + 1]))),
        Math.max(0, Math.min(255, Math.round(errorBuffer[idx * 3 + 2])))
      ]

      const { index } = findBestColorIndex(targetColor, palette)
      indexBuffer[idx] = index

      const quantized = palette[index]
      const error: Vector<'RGB'> = [
        (targetColor[0] - quantized[0]) * ditheringStrength,
        (targetColor[1] - quantized[1]) * ditheringStrength,
        (targetColor[2] - quantized[2]) * ditheringStrength
      ]

      distributeError(errorBuffer, x, y, width, height, error)
    }
  }

  return indexBuffer
}
