/**
 * Mode R Quantization
 *
 * Full image quantization for Mode R with line-by-line interlaced extraction:
 *
 * Input: High-resolution image (2× horizontal resolution)
 *        e.g., 320×200 for standard Mode 0
 *
 * Output: Two index buffers at Mode 0 resolution (160×200)
 *
 * Extraction pattern (alternates line by line):
 *   Even lines: Image A gets even pixels (0,2,4...), Image B gets odd pixels (1,3,5...)
 *   Odd lines:  Image A gets odd pixels (1,3,5...), Image B gets even pixels (0,2,4...)
 *
 * This pattern, combined with the CRTC horizontal shift that also alternates
 * per line and inverts between frames, creates doubled horizontal resolution.
 */

import { logger } from '@/core/logger'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { colorDistance } from './blend'
import { optimizeModeRPalettes } from './pair-optimizer'
import type {
  ModeRConfig,
  ModeRPalettes,
  ModeRQuantizationResult
} from './types'
import { DEFAULT_MODE_R_CONFIG } from './types'

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
 * Extract representative colors from an image using k-means-like sampling
 * Returns colors that represent the actual image content, not pre-quantized CPC colors
 */
function extractImageColors(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors: number
): Vector<'RGB'>[] {
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

  return sorted
    .slice(0, maxColors)
    .map((entry) => [
      Math.round(entry.color[0]),
      Math.round(entry.color[1]),
      Math.round(entry.color[2])
    ])
}

/**
 * Get pixel color from image data with optional dithering error applied
 */
function getPixelColorWithError(
  imageData: Uint8ClampedArray,
  errorBuffer: Float32Array | null,
  pixelIdx: number,
  errorIdx: number
): Vector<'RGB'> {
  const baseColor: Vector<'RGB'> = [
    imageData[pixelIdx],
    imageData[pixelIdx + 1],
    imageData[pixelIdx + 2]
  ]

  if (!errorBuffer) return baseColor

  return [
    Math.max(0, Math.min(255, baseColor[0] + errorBuffer[errorIdx])),
    Math.max(0, Math.min(255, baseColor[1] + errorBuffer[errorIdx + 1])),
    Math.max(0, Math.min(255, baseColor[2] + errorBuffer[errorIdx + 2]))
  ]
}

/**
 * Find the best pair of indices (idxA, idxB) such that blend(paletteA[idxA], paletteB[idxB])
 * is closest to the target color. This maximizes the color variety in Mode R.
 */
function findBestBlendPair(
  targetColor: Vector<'RGB'>,
  paletteA: Vector<'RGB'>[],
  paletteB: Vector<'RGB'>[]
): { indexA: number; indexB: number; error: number } {
  let bestIndexA = 0
  let bestIndexB = 0
  let bestError = Number.POSITIVE_INFINITY

  for (let a = 0; a < paletteA.length; a++) {
    for (let b = 0; b < paletteB.length; b++) {
      // Calculate the blended color (what the eye perceives)
      const blendedR = (paletteA[a][0] + paletteB[b][0]) / 2
      const blendedG = (paletteA[a][1] + paletteB[b][1]) / 2
      const blendedB = (paletteA[a][2] + paletteB[b][2]) / 2

      // Calculate error to target
      const dr = targetColor[0] - blendedR
      const dg = targetColor[1] - blendedG
      const db = targetColor[2] - blendedB
      const error = dr * dr + dg * dg + db * db

      if (error < bestError) {
        bestError = error
        bestIndexA = a
        bestIndexB = b
      }
    }
  }

  return { indexA: bestIndexA, indexB: bestIndexB, error: bestError }
}

/**
 * Quantize an image to Mode R format using line-by-line interlaced extraction
 *
 * @param imageData - Source image RGBA data at doubled horizontal resolution (e.g., 320×200)
 * @param width - Source image width (doubled Mode 0 width, e.g., 320)
 * @param height - Source image height (e.g., 200)
 * @param targetPalette - Pre-quantized 16-color palette (used as hint, not directly)
 * @param config - Mode R configuration
 * @returns Mode R quantization result with two index buffers
 */
export function quantizeModeR(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  config: ModeRConfig = DEFAULT_MODE_R_CONFIG
): ModeRQuantizationResult {
  // Step 1: Extract MORE colors from the image than just 16
  // Mode R can represent up to 256 blended colors, so we need more target colors
  // to optimize palettes properly. Extract 64 colors for better coverage.
  const imageColors = extractImageColors(
    imageData,
    width,
    height,
    64 // Extract 64 colors instead of just 16
  )

  // Step 2: Optimize dual palettes to cover as many of these colors as possible
  const palettes = optimizeModeRPalettes(imageColors, config)

  // Output dimensions (half the horizontal resolution)
  const outWidth = Math.floor(width / 2)
  const outHeight = height

  // Setup dithering
  const useDithering =
    config.ditheringMode === 'floyd-steinberg' && config.ditheringIntensity > 0
  const errorBuffer = useDithering ? new Float32Array(width * height * 3) : null
  const ditherIntensity = config.ditheringIntensity / 100

  // Step 3: Create two index buffers with interlaced line-by-line extraction
  const indexBufferA = new Uint8Array(outWidth * outHeight)
  const indexBufferB = new Uint8Array(outWidth * outHeight)
  let totalError = 0

  for (let y = 0; y < outHeight; y++) {
    const isEvenLine = y % 2 === 0

    for (let x = 0; x < outWidth; x++) {
      // Interlaced pixel extraction based on line parity
      const srcXA = isEvenLine ? x * 2 : x * 2 + 1
      const srcXB = isEvenLine ? x * 2 + 1 : x * 2

      // Get source colors with accumulated dithering error
      const colorA = getPixelColorWithError(
        imageData,
        errorBuffer,
        (y * width + srcXA) * 4,
        (y * width + srcXA) * 3
      )
      const colorB = getPixelColorWithError(
        imageData,
        errorBuffer,
        (y * width + srcXB) * 4,
        (y * width + srcXB) * 3
      )

      // For Mode R, we want the PERCEIVED color to match the target
      // The perceived color is the average of colorA and colorB sources
      // So we find the best pair that blends to this average
      const targetBlend: Vector<'RGB'> = [
        (colorA[0] + colorB[0]) / 2,
        (colorA[1] + colorB[1]) / 2,
        (colorA[2] + colorB[2]) / 2
      ]

      // Find the best pair (idxA, idxB) whose blend matches targetBlend
      const bestPair = findBestBlendPair(
        targetBlend,
        palettes.paletteA,
        palettes.paletteB
      )

      const outIdx = y * outWidth + x
      indexBufferA[outIdx] = bestPair.indexA
      indexBufferB[outIdx] = bestPair.indexB
      totalError += bestPair.error

      // Propagate dithering error based on the blended result
      if (errorBuffer) {
        const chosenBlend: Vector<'RGB'> = [
          (palettes.paletteA[bestPair.indexA][0] +
            palettes.paletteB[bestPair.indexB][0]) /
            2,
          (palettes.paletteA[bestPair.indexA][1] +
            palettes.paletteB[bestPair.indexB][1]) /
            2,
          (palettes.paletteA[bestPair.indexA][2] +
            palettes.paletteB[bestPair.indexB][2]) /
            2
        ]
        // Distribute error to both source positions
        const errorHalf: Vector<'RGB'> = [
          ((targetBlend[0] - chosenBlend[0]) * ditherIntensity) / 2,
          ((targetBlend[1] - chosenBlend[1]) * ditherIntensity) / 2,
          ((targetBlend[2] - chosenBlend[2]) * ditherIntensity) / 2
        ]
        propagateError(errorBuffer, width, height, srcXA, y, errorHalf)
        propagateError(errorBuffer, width, height, srcXB, y, errorHalf)
      }
    }
  }

  // Count unique blends actually used in the image
  const usedBlends = new Set<string>()
  for (let i = 0; i < indexBufferA.length; i++) {
    const idxA = indexBufferA[i]
    const idxB = indexBufferB[i]
    usedBlends.add(`${idxA},${idxB}`)
  }

  logger.info('[Mode R] Quantization complete:', {
    imageSize: `${width}×${height}`,
    outputSize: `${outWidth}×${outHeight}`,
    possibleBlends: palettes.stats.uniquePerceivedColors,
    actualBlendsUsed: usedBlends.size,
    totalError: Math.round(totalError)
  })

  return { indexBufferA, indexBufferB, palettes, totalError }
}

/**
 * Propagate quantization error to neighboring pixels (Floyd-Steinberg)
 */
function propagateError(
  errorBuffer: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  error: Vector<'RGB'>
): void {
  // Floyd-Steinberg distribution:
  //       * 7/16
  // 3/16 5/16 1/16

  const distribute = (dx: number, dy: number, factor: number): void => {
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const idx = (ny * width + nx) * 3
      errorBuffer[idx] += error[0] * factor
      errorBuffer[idx + 1] += error[1] * factor
      errorBuffer[idx + 2] += error[2] * factor
    }
  }

  distribute(1, 0, 7 / 16) // right
  distribute(-1, 1, 3 / 16) // bottom-left
  distribute(0, 1, 5 / 16) // bottom
  distribute(1, 1, 1 / 16) // bottom-right
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
 * - On even lines: position 0 shows A, position 1 shows B, position 2 shows A...
 * - On odd lines: position 0 shows B, position 1 shows A, position 2 shows B...
 *
 * The perceived color at each sub-pixel is the temporal blend of what's shown there
 * across the two frames. Due to the interlacing pattern:
 * - Even line sub-pixels: even positions see (A+B)/2, odd positions see (B+A)/2
 * - But wait - that's the same! The key is the SPATIAL information.
 *
 * Actually, the key insight is that adjacent MODE 0 pixels can show different
 * blended colors because they come from different source sub-pixels.
 *
 * Let's trace through for clarity:
 * - Source pixel at (2x, y) on even line → goes to Frame A index buffer
 * - Source pixel at (2x+1, y) on even line → goes to Frame B index buffer
 * - The OUTPUT at position x shows blend(paletteA[idxA], paletteB[idxB])
 *
 * So the output IS at Mode 0 resolution, but each pixel represents a UNIQUE blend
 * from two different source sub-pixels. The "resolution improvement" comes from
 * having more color variety, not more spatial pixels.
 *
 * For visualization, we show at 2× width with each blend pixel doubled.
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
    for (let x = 0; x < width; x++) {
      const srcIdx = y * width + x

      const colorA = palettes.paletteA[indexBufferA[srcIdx]]
      const colorB = palettes.paletteB[indexBufferB[srcIdx]]

      // The perceived color is the temporal average of A and B
      // This is what the eye sees due to persistence of vision at 50Hz
      const blendedR = Math.round((colorA[0] + colorB[0]) / 2)
      const blendedG = Math.round((colorA[1] + colorB[1]) / 2)
      const blendedB = Math.round((colorA[2] + colorB[2]) / 2)

      // Fill both sub-pixels with the blended color
      // (Each Mode 0 pixel becomes 2 display pixels)
      const dstIdx1 = (y * outWidth + x * 2) * 4
      const dstIdx2 = (y * outWidth + x * 2 + 1) * 4

      imageData[dstIdx1] = blendedR
      imageData[dstIdx1 + 1] = blendedG
      imageData[dstIdx1 + 2] = blendedB
      imageData[dstIdx1 + 3] = 255

      imageData[dstIdx2] = blendedR
      imageData[dstIdx2 + 1] = blendedG
      imageData[dstIdx2 + 2] = blendedB
      imageData[dstIdx2 + 3] = 255
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

  // Calculate luminance for all colors
  const calcLum = (c: Vector<'RGB'>) =>
    0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

  // Find max flicker for normalization
  let maxFlicker = 0
  for (let i = 0; i < indexBufferA.length; i++) {
    const lumA = calcLum(palettes.paletteA[indexBufferA[i]])
    const lumB = calcLum(palettes.paletteB[indexBufferB[i]])
    const flicker = Math.abs(lumA - lumB)
    if (flicker > maxFlicker) maxFlicker = flicker
  }
  if (maxFlicker === 0) maxFlicker = 1

  for (let i = 0; i < indexBufferA.length; i++) {
    const lumA = calcLum(palettes.paletteA[indexBufferA[i]])
    const lumB = calcLum(palettes.paletteB[indexBufferB[i]])
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
  const palettes = optimizeModeRPalettes(targetPalette, config)

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
