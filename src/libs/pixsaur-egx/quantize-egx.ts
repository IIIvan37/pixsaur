/**
 * EGX Quantization
 *
 * Quantizes an image for EGX mode, respecting per-line color constraints.
 *
 * Unlike standard quantization where all pixels can use the full palette,
 * EGX has different constraints per line:
 * - Low-res lines (Mode 0 for EGX1): Can use all 16 colors
 * - High-res lines (Mode 1 for EGX1): Can only use INK 0-3
 */

import {
  colorDistanceSquared,
  findClosestInSubset
} from '@/libs/pixsaur-color/src/metric/find-closest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { optimizeEGXPalette } from './palette-optimizer'
import type { EGXConfig, EGXQuantizationResult } from './types'
import {
  DEFAULT_EGX_CONFIG,
  generateLineEncodings,
  getEGXOutputDimensions,
  getMaxColorIndex,
  getModeForLine
} from './types'

// ============================================================================
// Main Quantization
// ============================================================================

/**
 * Quantize an image for EGX mode
 *
 * @param imageData - Source image RGBA data
 * @param width - Source image width
 * @param height - Source image height
 * @param config - EGX configuration
 * @returns EGX quantization result
 */
export function quantizeEGX(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  config: EGXConfig = DEFAULT_EGX_CONFIG
): EGXQuantizationResult {
  // Get output dimensions for this EGX type
  const outputDims = getEGXOutputDimensions(config.type)

  // Resize if needed (simple nearest-neighbor for now)
  const resizedData =
    width === outputDims.width && height === outputDims.height
      ? imageData
      : resizeImage(
          imageData,
          width,
          height,
          outputDims.width,
          outputDims.height
        )

  const outWidth = outputDims.width
  const outHeight = outputDims.height

  // Optimize palette with EGX constraints
  const palette = optimizeEGXPalette(resizedData, outWidth, outHeight, config)

  // Generate line encodings
  const lineEncodings = generateLineEncodings(outHeight, config)

  // Quantize each pixel according to its line's constraints
  const indexBuffer = new Uint8Array(outWidth * outHeight)
  let totalError = 0

  for (let y = 0; y < outHeight; y++) {
    const mode = getModeForLine(y, config)
    const maxColorIndex = getMaxColorIndex(mode, config.type)

    for (let x = 0; x < outWidth; x++) {
      const pixelIdx = (y * outWidth + x) * 4
      const targetColor: Vector<'RGB'> = [
        resizedData[pixelIdx],
        resizedData[pixelIdx + 1],
        resizedData[pixelIdx + 2]
      ]

      const { index, color } = findClosestInSubset(
        targetColor,
        palette.colors,
        maxColorIndex
      )

      // Calculate distance for stats
      const distance = colorDistanceSquared(targetColor, color)

      indexBuffer[y * outWidth + x] = index
      totalError += distance
    }
  }

  return {
    indexBuffer,
    width: outWidth,
    height: outHeight,
    palette,
    lineEncodings,
    totalError
  }
}

// ============================================================================
// Image Resize (simple nearest-neighbor)
// ============================================================================

/**
 * Simple nearest-neighbor resize
 */
function resizeImage(
  src: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstWidth * dstHeight * 4)

  const xRatio = srcWidth / dstWidth
  const yRatio = srcHeight / dstHeight

  for (let y = 0; y < dstHeight; y++) {
    const srcY = Math.floor(y * yRatio)
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.floor(x * xRatio)

      const srcIdx = (srcY * srcWidth + srcX) * 4
      const dstIdx = (y * dstWidth + x) * 4

      dst[dstIdx] = src[srcIdx]
      dst[dstIdx + 1] = src[srcIdx + 1]
      dst[dstIdx + 2] = src[srcIdx + 2]
      dst[dstIdx + 3] = src[srcIdx + 3]
    }
  }

  return dst
}

// ============================================================================
// Preview Generation
// ============================================================================

/** Render a pixel for mode map visualization */
function renderModeMapPixel(
  output: Uint8ClampedArray,
  outIdx: number,
  isHighResLine: boolean
): void {
  if (isHighResLine) {
    output[outIdx] = 50
    output[outIdx + 1] = 100
    output[outIdx + 2] = 200
  } else {
    output[outIdx] = 200
    output[outIdx + 1] = 120
    output[outIdx + 2] = 50
  }
  output[outIdx + 3] = 255
}

/** Render a gray pixel */
function renderGrayPixel(output: Uint8ClampedArray, outIdx: number): void {
  output[outIdx] = 128
  output[outIdx + 1] = 128
  output[outIdx + 2] = 128
  output[outIdx + 3] = 255
}

/** Render a normal color pixel */
function renderColorPixel(
  output: Uint8ClampedArray,
  outIdx: number,
  color: Vector<'RGB'>
): void {
  output[outIdx] = color[0]
  output[outIdx + 1] = color[1]
  output[outIdx + 2] = color[2]
  output[outIdx + 3] = 255
}

/**
 * Generate a preview image from quantization result
 */
export function generateEGXPreview(
  result: EGXQuantizationResult,
  mode: 'combined' | 'highLines' | 'lowLines' | 'modeMap' = 'combined'
): Uint8ClampedArray {
  const { indexBuffer, width, height, palette, lineEncodings } = result
  const output = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    const encoding = lineEncodings[y]
    const isHighResLine = encoding.mode !== 0

    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const outIdx = idx * 4

      if (mode === 'modeMap') {
        renderModeMapPixel(output, outIdx, isHighResLine)
        continue
      }

      const shouldGrayOut =
        (mode === 'highLines' && !isHighResLine) ||
        (mode === 'lowLines' && isHighResLine)

      if (shouldGrayOut) {
        renderGrayPixel(output, outIdx)
        continue
      }

      const color = palette.colors[indexBuffer[idx]]
      renderColorPixel(output, outIdx, color)
    }
  }

  return output
}

/**
 * Generate a preview at Mode 0 resolution (for display)
 * Useful when EGX1 outputs at 320px but we want to show 160px
 */
export function generateEGXPreviewMode0(
  result: EGXQuantizationResult
): Uint8ClampedArray {
  const { indexBuffer, width, height, palette, lineEncodings } = result

  // For EGX1, output is 320px, Mode 0 is 160px
  const outWidth = Math.floor(width / 2)
  const output = new Uint8ClampedArray(outWidth * height * 4)

  for (let y = 0; y < height; y++) {
    const encoding = lineEncodings[y]

    for (let x = 0; x < outWidth; x++) {
      const outIdx = (y * outWidth + x) * 4

      if (encoding.mode === 0) {
        // Mode 0 line: 1 pixel = 2 output pixels, so just take x*2
        const srcIdx = y * width + x * 2
        const colorIndex = indexBuffer[srcIdx]
        const color = palette.colors[colorIndex]
        output[outIdx] = color[0]
        output[outIdx + 1] = color[1]
        output[outIdx + 2] = color[2]
      } else {
        // Mode 1 line: average 2 adjacent pixels
        const srcIdx1 = y * width + x * 2
        const srcIdx2 = y * width + x * 2 + 1
        const color1 = palette.colors[indexBuffer[srcIdx1]]
        const color2 = palette.colors[indexBuffer[srcIdx2]]
        output[outIdx] = Math.round((color1[0] + color2[0]) / 2)
        output[outIdx + 1] = Math.round((color1[1] + color2[1]) / 2)
        output[outIdx + 2] = Math.round((color1[2] + color2[2]) / 2)
      }
      output[outIdx + 3] = 255
    }
  }

  return output
}
