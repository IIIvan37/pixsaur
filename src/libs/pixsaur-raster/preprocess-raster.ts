/**
 * Raster Preprocessing
 *
 * Pre-process images for raster optimization using:
 * 1. Farthest point sampling for palette selection
 * 2. Horizontal 1D dithering with Floyd-Steinberg
 * 3. Vertical error compensation between lines
 * 4. Palette continuity penalty
 */

import { weightedRGBDistance } from '../pixsaur-color/src/metric/distance'
import { findClosestColorIndex } from '../pixsaur-color/src/metric/find-closest'
import type { Vector } from '../pixsaur-color/src/type'
import {
  createQuantizeFunction,
  getCPCClassicLUT,
  needsLUTRebuild
} from './color-quantization'
import { extractGlobalPaletteFromImage } from './line-palette-optimizer'
import { colorKey, selectPaletteFarthestPoint } from './palette-selection'
import { rasterTuningOverrides } from './raster-tuning'

// ============================================================================
// Error Diffusion Helpers
// ============================================================================

/**
 * Add two error vectors
 */
function addErrors(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/**
 * Add color and error, clamping to valid RGB range
 */
function addColors(
  color: Vector<'RGB'>,
  error: [number, number, number]
): Vector<'RGB'> {
  return [
    Math.max(0, Math.min(255, color[0] + error[0])),
    Math.max(0, Math.min(255, color[1] + error[1])),
    Math.max(0, Math.min(255, color[2] + error[2]))
  ]
}

/**
 * Scale an error vector
 */
function scaleError(
  e: [number, number, number],
  factor: number
): [number, number, number] {
  return [e[0] * factor, e[1] * factor, e[2] * factor]
}

// ============================================================================
// Posterization
// ============================================================================

/**
 * Posterize an image to reduce color count while preserving important transitions.
 * This is a preprocessing step for raster optimization.
 *
 * @param sourceImage - The source image to posterize
 * @param levels - Number of levels per channel (default 8 = 512 possible colors)
 * @param globalPalette - Optional anchor colors to preserve exactly
 * @returns Posterized ImageData
 */
export function posterizeImage(
  sourceImage: ImageData,
  levels: number = 8,
  globalPalette: Vector<'RGB'>[] = []
): ImageData {
  const { width, height, data } = sourceImage
  const outputData = new Uint8ClampedArray(data.length)

  const step = Math.floor(256 / levels)
  const posterize = (v: number): number => {
    const level = Math.round(v / step)
    return Math.min(255, level * step)
  }

  const anchorThreshold = step * step * 3

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    let snappedToAnchor = false
    for (const anchor of globalPalette) {
      const dr = r - anchor[0]
      const dg = g - anchor[1]
      const db = b - anchor[2]
      const dist = dr * dr + dg * dg + db * db

      if (dist <= anchorThreshold) {
        outputData[i] = anchor[0]
        outputData[i + 1] = anchor[1]
        outputData[i + 2] = anchor[2]
        outputData[i + 3] = a
        snappedToAnchor = true
        break
      }
    }

    if (!snappedToAnchor) {
      outputData[i] = posterize(r)
      outputData[i + 1] = posterize(g)
      outputData[i + 2] = posterize(b)
      outputData[i + 3] = a
    }
  }

  return new ImageData(outputData, width, height)
}

// ============================================================================
// Preprocessing Options
// ============================================================================

/**
 * Options for raster preprocessing
 */
export interface RasterPreprocessOptions {
  /**
   * Dithering intensity from 0 (no dithering) to 1 (full dithering)
   * Default: 0.75
   */
  ditheringIntensity?: number
  /**
   * Number of colors per line for the current CPC mode.
   * Mode 0: 16, Mode 1: 4, Mode 2: 2
   * Default: 4 (Mode 1)
   */
  nColors?: number
  /**
   * CPC Classic hardware palette (27 colors).
   */
  cpcClassicPalette?: Vector<'RGB'>[]
}

// ============================================================================
// Main Preprocessing Function
// ============================================================================

/**
 * Pre-process an image using the improved raster pipeline.
 *
 * This implements:
 * 1. Farthest point sampling for palette selection (§5.1.1)
 * 2. Horizontal 1D dithering with Floyd-Steinberg (§5.2)
 * 3. Vertical error compensation between lines (§5.3)
 * 4. Palette continuity penalty (§5.1.2)
 *
 * @param sourceImage - Original image data
 * @param _globalPalette - IGNORED - kept for API compatibility
 * @param options - Optional preprocessing options
 * @returns Pre-processed ImageData with max nColors colors per line
 */
export function preprocessImageForRaster(
  sourceImage: ImageData,
  _globalPalette: Vector<'RGB'>[],
  options: RasterPreprocessOptions = {}
): ImageData {
  let { ditheringIntensity = 0.75, nColors = 4, cpcClassicPalette } = options
  ditheringIntensity = Math.min(ditheringIntensity, 1)
  const { width, height, data } = sourceImage
  const outputData = new Uint8ClampedArray(data.length)

  // Build LUT for CPC Classic if needed
  if (cpcClassicPalette && needsLUTRebuild(cpcClassicPalette)) {
    getCPCClassicLUT(cpcClassicPalette)
  }

  const lut = cpcClassicPalette ? getCPCClassicLUT(cpcClassicPalette) : null
  const quantizeColor = createQuantizeFunction(cpcClassicPalette, lut)

  // Extract initial global palette from the source image
  const extractedPalette = extractGlobalPaletteFromImage(
    sourceImage,
    nColors,
    cpcClassicPalette
  )
  while (extractedPalette.length < nColors) {
    extractedPalette.push([0, 0, 0])
  }

  // Vertical error buffer
  let verticalError: [number, number, number][] = new Array(width)
    .fill(null)
    .map(() => [0, 0, 0])

  let previousPalette: Vector<'RGB'>[] = extractedPalette

  // Process each line
  for (let line = 0; line < height; line++) {
    const lineStart = line * width * 4

    // Build color histogram for this line
    const colorHistogram = new Map<
      string,
      { color: Vector<'RGB'>; count: number }
    >()

    for (let x = 0; x < width; x++) {
      const pixelIdx = lineStart + x * 4
      const sourceColor: Vector<'RGB'> = [
        data[pixelIdx],
        data[pixelIdx + 1],
        data[pixelIdx + 2]
      ]

      const correctedColor = addColors(sourceColor, verticalError[x])
      const quantized = quantizeColor(correctedColor)
      const key = colorKey(quantized)

      const existing = colorHistogram.get(key)
      if (existing) {
        existing.count++
      } else {
        colorHistogram.set(key, { color: quantized, count: 1 })
      }
    }

    // Select palette using farthest point sampling
    const linePalette = selectPaletteFarthestPoint(
      colorHistogram,
      nColors,
      previousPalette
    )

    // Ensure nColors colors
    while (linePalette.length < nColors) {
      for (const pc of previousPalette) {
        if (linePalette.length >= nColors) break
        const key = colorKey(pc)
        if (!linePalette.some((c) => colorKey(c) === key)) {
          linePalette.push(pc)
        }
      }
      if (linePalette.length < nColors) {
        linePalette.push([0, 0, 0])
      }
    }

    const quantizedPalette = linePalette.map((c) => quantizeColor(c))

    const lineAlreadySatisfiesConstraint = colorHistogram.size <= nColors
    const shouldApplyDithering =
      !lineAlreadySatisfiesConstraint || ditheringIntensity > 0

    const newVerticalError: [number, number, number][] = new Array(width)
      .fill(null)
      .map(() => [0, 0, 0])

    if (shouldApplyDithering) {
      processLineWithDithering(
        line,
        width,
        data,
        outputData,
        verticalError,
        newVerticalError,
        quantizedPalette,
        ditheringIntensity
      )
    } else {
      processLineWithoutDithering(
        line,
        width,
        data,
        outputData,
        quantizedPalette
      )
    }

    verticalError = newVerticalError
    previousPalette = quantizedPalette
  }

  return new ImageData(outputData, width, height)
}

// ============================================================================
// Line Processing Helpers
// ============================================================================

function processLineWithDithering(
  line: number,
  width: number,
  data: Uint8ClampedArray,
  outputData: Uint8ClampedArray,
  verticalError: [number, number, number][],
  newVerticalError: [number, number, number][],
  quantizedPalette: Vector<'RGB'>[],
  ditheringIntensity: number
): void {
  const lineStart = line * width * 4
  const horizError: [number, number, number][] = new Array(width)
    .fill(null)
    .map(() => [0, 0, 0])

  for (let x = 0; x < width; x++) {
    const pixelIdx = lineStart + x * 4
    const sourceColor: Vector<'RGB'> = [
      data[pixelIdx],
      data[pixelIdx + 1],
      data[pixelIdx + 2]
    ]

    // Apply accumulated error
    const rawTotalError = addErrors(verticalError[x], horizError[x])
    const maxAccumulatedError = 32 * ditheringIntensity
    const totalError: [number, number, number] = [
      Math.max(
        -maxAccumulatedError,
        Math.min(maxAccumulatedError, rawTotalError[0])
      ),
      Math.max(
        -maxAccumulatedError,
        Math.min(maxAccumulatedError, rawTotalError[1])
      ),
      Math.max(
        -maxAccumulatedError,
        Math.min(maxAccumulatedError, rawTotalError[2])
      )
    ]

    // Asymmetric clamping to prevent dark artifacts
    const maxDarken = sourceColor[0] * 0.3 * ditheringIntensity
    const maxDarkenG = sourceColor[1] * 0.3 * ditheringIntensity
    const maxDarkenB = sourceColor[2] * 0.3 * ditheringIntensity

    const targetR = Math.max(
      sourceColor[0] - maxDarken,
      Math.min(255, sourceColor[0] + totalError[0])
    )
    const targetG = Math.max(
      sourceColor[1] - maxDarkenG,
      Math.min(255, sourceColor[1] + totalError[1])
    )
    const targetB = Math.max(
      sourceColor[2] - maxDarkenB,
      Math.min(255, sourceColor[2] + totalError[2])
    )

    const correctedColor: Vector<'RGB'> = [
      Math.max(0, Math.min(255, targetR)),
      Math.max(0, Math.min(255, targetG)),
      Math.max(0, Math.min(255, targetB))
    ]

    // Find closest palette color
    const closestIdx = findClosestColorIndex(
      correctedColor,
      quantizedPalette,
      weightedRGBDistance
    )
    const chosenColor = quantizedPalette[closestIdx]

    // Calculate and clamp error
    const rawError: [number, number, number] = [
      correctedColor[0] - chosenColor[0],
      correctedColor[1] - chosenColor[1],
      correctedColor[2] - chosenColor[2]
    ]

    const maxError = 24 * ditheringIntensity
    const error: [number, number, number] = [
      Math.max(-maxError, Math.min(maxError, rawError[0])),
      Math.max(-maxError, Math.min(maxError, rawError[1])),
      Math.max(-maxError, Math.min(maxError, rawError[2]))
    ]

    // Distribute error
    const horizCoef =
      (rasterTuningOverrides.horizontalErrorCoefficient ?? 0.55) *
      ditheringIntensity
    const vertCoef =
      (rasterTuningOverrides.verticalErrorCoefficient ?? 0.13) *
      ditheringIntensity

    if (x + 1 < width && horizCoef > 0) {
      const he = scaleError(error, horizCoef)
      horizError[x + 1] = addErrors(horizError[x + 1], he)
    }

    if (vertCoef > 0) {
      const ve = scaleError(error, vertCoef)
      newVerticalError[x] = addErrors(newVerticalError[x], ve)
    }

    // Write output pixel
    outputData[pixelIdx] = chosenColor[0]
    outputData[pixelIdx + 1] = chosenColor[1]
    outputData[pixelIdx + 2] = chosenColor[2]
    outputData[pixelIdx + 3] = 255
  }
}

function processLineWithoutDithering(
  line: number,
  width: number,
  data: Uint8ClampedArray,
  outputData: Uint8ClampedArray,
  quantizedPalette: Vector<'RGB'>[]
): void {
  const lineStart = line * width * 4

  for (let x = 0; x < width; x++) {
    const pixelIdx = lineStart + x * 4
    const sourceColor: Vector<'RGB'> = [
      data[pixelIdx],
      data[pixelIdx + 1],
      data[pixelIdx + 2]
    ]

    // Find closest color in pre-quantized palette
    const closestIdx = findClosestColorIndex(
      sourceColor,
      quantizedPalette,
      weightedRGBDistance
    )
    const chosenColor = quantizedPalette[closestIdx]

    outputData[pixelIdx] = chosenColor[0]
    outputData[pixelIdx + 1] = chosenColor[1]
    outputData[pixelIdx + 2] = chosenColor[2]
    outputData[pixelIdx + 3] = 255
  }
}
