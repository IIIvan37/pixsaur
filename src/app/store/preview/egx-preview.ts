/**
 * EGX Preview Atoms
 *
 * Handles the line-by-line mode alternation preview pipeline for EGX.
 * EGX alternates video modes per line (spatial interlacing, no flicker).
 *
 * IMPORTANT: This implementation reuses the standard quantizer's palette
 * and dithering infrastructure, applying EGX constraints only at render time.
 */

import { atom } from 'jotai'
import type { CpcModeConfig } from '@/app/store/config/types'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig, EGXType } from '@/libs/pixsaur-egx'
import {
  getMaxColorIndex,
  getModeForLine,
  getSharedColorCount
} from '@/libs/pixsaur-egx'
import {
  applyHorizontalSmoothing,
  getPixelWidthForMode,
  getVisualRegionNormalized
} from '@/preview'
import { applyResize, type Selection } from '@/source'
import {
  centerImageAtom,
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  egxEnabledAtom,
  egxFirstLineModeAtom,
  egxPreviewModeAtom,
  egxTypeAtom,
  horizontalSmoothingAtom,
  resizeModeAtom
} from '../config/config'
import { selectionAtom, workingImageAtom } from '../image/image'
import { userPaletteAtom } from '../palette/palette'
import type { PaletteSlot } from '../palette/types'
import {
  applyManualEditsToBuffer,
  exportPaletteWithSlotsAtom,
  manualPixelEditsAtom,
  positionImageForAutoMode
} from './preview'

// ============================================================================
// EGX Configuration Atom
// ============================================================================

/**
 * Derived EGX configuration from individual settings
 */
export const egxConfigAtom = atom((get): EGXConfig => {
  const type = get(egxTypeAtom)
  const firstLineMode = get(egxFirstLineModeAtom)
  const hardware = get(cpcHardwareAtom)
  const dithering = get(ditheringAtom)

  const ditheringEnabled = dithering.mode !== 'none'
  const ditheringIntensity = ditheringEnabled
    ? Math.round(dithering.intensity * 100)
    : 0

  return {
    type,
    firstLineMode,
    targetHardware: hardware,
    ditheringMode: ditheringEnabled ? dithering.mode : 'none',
    ditheringIntensity
  }
})

// ============================================================================
// EGX Mode Config Helper
// ============================================================================

/**
 * Get the CPC mode config for EGX based on the high-resolution mode.
 * EGX1: Uses Mode 1 dimensions (320×200 standard, 384×280 overscan)
 * EGX2: Uses Mode 2 dimensions (640×200 standard, 768×280 overscan)
 */
function getEGXModeConfig(
  egxType: EGXType,
  baseModeConfig: CpcModeConfig
): CpcModeConfig {
  // EGX uses the high-resolution mode dimensions
  // EGX1: Mode 1 (320px wide), EGX2: Mode 2 (640px wide)
  const highResMode = egxType === 'egx1' ? 1 : 2

  // Calculate width based on the high-res mode
  // Mode 0: 160px, Mode 1: 320px, Mode 2: 640px
  // The ratio is: Mode 1 = 2× Mode 0, Mode 2 = 4× Mode 0
  const widthMultiplier = egxType === 'egx1' ? 2 : 4
  const baseWidthMode0 =
    baseModeConfig.width /
    (baseModeConfig.mode === 0 ? 1 : baseModeConfig.mode === 1 ? 2 : 4)
  const egxWidth = Math.round(baseWidthMode0 * widthMultiplier)

  return {
    ...baseModeConfig,
    mode: highResMode,
    width: egxWidth,
    // EGX has square-ish pixels (no horizontal stretching)
    scaleX: 1,
    scaleY: egxType === 'egx1' ? 1 : 2, // Mode 2 has tall pixels
    // EGX1: 16 colors (like Mode 0), EGX2: 4 colors (like Mode 1)
    nColors: egxType === 'egx1' ? 16 : 4
  }
}

/**
 * Atom that provides the effective mode config for EGX.
 * Uses high-resolution mode dimensions.
 */
export const egxModeConfigAtom = atom((get): CpcModeConfig | null => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const egxType = get(egxTypeAtom)
  const baseModeConfig = get(effectiveModeConfigAtom)

  return getEGXModeConfig(egxType, baseModeConfig)
})

// ============================================================================
// EGX Normalized Image
// ============================================================================

/**
 * Image resized and normalized to EGX dimensions (high-resolution mode).
 * Uses the source image (not the standard pipeline's resized image)
 * to ensure correct dimensions:
 * - EGX1: 320×200 (or overscan equivalent)
 * - EGX2: 640×200 (or overscan equivalent)
 */
export const egxNormalizedImageAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const egxModeConfig = get(egxModeConfigAtom)
  const workingImage = await get(workingImageAtom)
  const selection = get(selectionAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)
  const horizontalSmoothing = get(horizontalSmoothingAtom)
  const palette = await get(exportPaletteWithSlotsAtom)

  if (!egxModeConfig || !workingImage || !selection) return null

  // 1. Crop the selection from the working image
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = selection.width
  cropCanvas.height = selection.height
  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) return null

  // Put the working image on a temp canvas to extract the selection
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = workingImage.width
  tempCanvas.height = workingImage.height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return null
  tempCtx.putImageData(workingImage, 0, 0)

  // Extract the selection
  cropCtx.drawImage(
    tempCanvas,
    selection.sx,
    selection.sy,
    selection.width,
    selection.height,
    0,
    0,
    selection.width,
    selection.height
  )

  // 2. Resize based on mode
  let resizedImageData: ImageData

  if (resizeMode === 'origin') {
    // Mode origin: use applyResize which handles the pixel ratio
    const relativeSelection: Selection = {
      sx: 0,
      sy: 0,
      width: selection.width,
      height: selection.height
    }

    let resizedCanvas: HTMLCanvasElement
    try {
      resizedCanvas = applyResize(
        cropCanvas,
        relativeSelection,
        {
          mode: resizeMode,
          modeConfig: egxModeConfig
        },
        centerImage
      )
    } catch {
      logger.warn('[EGX] Failed to resize image')
      return null
    }

    const resizedCtx = resizedCanvas.getContext('2d')
    if (!resizedCtx) return null
    resizedImageData = resizedCtx.getImageData(
      0,
      0,
      resizedCanvas.width,
      resizedCanvas.height
    )
  } else {
    // Mode auto: normalize to EGX dimensions using getVisualRegionNormalized
    const croppedImageData = cropCtx.getImageData(
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    )
    const normalized = getVisualRegionNormalized(
      croppedImageData,
      egxModeConfig
    )
    if (!normalized) {
      logger.warn('[EGX] Failed to normalize image')
      return null
    }

    // Position in target dimensions (adds margins with darkest color)
    resizedImageData = positionImageForAutoMode(
      normalized,
      egxModeConfig,
      palette,
      centerImage
    )
  }

  // 3. Apply horizontal smoothing if enabled
  if (horizontalSmoothing) {
    const pixelWidth = getPixelWidthForMode(egxModeConfig.mode)
    resizedImageData = applyHorizontalSmoothing(resizedImageData, pixelWidth)
  }

  logger.info('[EGX] Normalized image', {
    width: resizedImageData.width,
    height: resizedImageData.height,
    targetWidth: egxModeConfig.width,
    targetHeight: egxModeConfig.height
  })

  return resizedImageData
})

// ============================================================================
// EGX Palette Optimization
// ============================================================================

/**
 * Analyze color usage on high-resolution lines to determine
 * which colors should be in the shared slots (INK 0-3 for EGX1, INK 0-1 for EGX2)
 */
function analyzeHighResLineColors(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig
): Map<number, number> {
  const colorUsage = new Map<number, number>()
  const { width, height } = imageData
  const data = imageData.data

  // Initialize usage counts
  for (let i = 0; i < palette.length; i++) {
    colorUsage.set(i, 0)
  }

  // Analyze only high-resolution lines
  for (let y = 0; y < height; y++) {
    const isHighResLine =
      (config.firstLineMode === 'low' && y % 2 !== 0) ||
      (config.firstLineMode === 'high' && y % 2 === 0)

    if (!isHighResLine) continue

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const pixel: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]

      // Find closest color in palette
      let bestIndex = 0
      let bestDist = Infinity
      for (let i = 0; i < palette.length; i++) {
        const dist = colorDistanceSquared(pixel, palette[i])
        if (dist < bestDist) {
          bestDist = dist
          bestIndex = i
        }
      }

      colorUsage.set(bestIndex, (colorUsage.get(bestIndex) ?? 0) + 1)
    }
  }

  return colorUsage
}

/**
 * Reorder palette so that the most used colors on high-res lines
 * are in the shared slots (first N positions).
 *
 * Also ensures color diversity: if two selected colors are too similar,
 * the second one is replaced by the next most-used distinct color.
 */
function optimizePaletteForEGX(
  palette: Vector<'RGB'>[],
  colorUsage: Map<number, number>,
  sharedCount: number
): Vector<'RGB'>[] {
  // Sort color indices by usage (descending)
  const sortedIndices = [...colorUsage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx]) => idx)

  // Minimum distance threshold for diversity (squared)
  // This prevents selecting two very similar colors (e.g., two near-blacks)
  const MIN_DISTANCE_SQ = 50 * 50 // ~50 RGB units difference

  // Select shared colors with diversity constraint
  const selectedIndices: number[] = []
  for (const idx of sortedIndices) {
    if (selectedIndices.length >= sharedCount) break

    const candidate = palette[idx]

    // Check if candidate is sufficiently different from already selected colors
    const isTooSimilar = selectedIndices.some((selectedIdx) => {
      const selected = palette[selectedIdx]
      return colorDistanceSquared(candidate, selected) < MIN_DISTANCE_SQ
    })

    if (!isTooSimilar) {
      selectedIndices.push(idx)
    }
  }

  // If we couldn't find enough diverse colors, fill with most-used remaining
  for (const idx of sortedIndices) {
    if (selectedIndices.length >= sharedCount) break
    if (!selectedIndices.includes(idx)) {
      selectedIndices.push(idx)
    }
  }

  // Build remaining indices (colors not selected for shared slots)
  const remainingIndices = sortedIndices.filter(
    (idx) => !selectedIndices.includes(idx)
  )

  // Build optimized palette
  const optimized: Vector<'RGB'>[] = []

  // First: shared colors (most used on high-res lines, with diversity)
  for (const idx of selectedIndices) {
    optimized.push(palette[idx])
  }

  // Then: remaining colors
  for (const idx of remainingIndices) {
    optimized.push(palette[idx])
  }

  // Pad with black if needed
  while (optimized.length < palette.length) {
    optimized.push([0, 0, 0])
  }

  return optimized
}

// ============================================================================
// Color Distance Utilities
// ============================================================================

function colorDistanceSquared(a: Vector<'RGB'>, b: Vector<'RGB'>): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

function findClosestInSubset(
  target: Vector<'RGB'>,
  palette: Vector<'RGB'>[],
  maxIndex: number
): { index: number; color: Vector<'RGB'> } {
  let bestIndex = 0
  let bestDist = Infinity

  const limit = Math.min(maxIndex + 1, palette.length)
  for (let i = 0; i < limit; i++) {
    const dist = colorDistanceSquared(target, palette[i])
    if (dist < bestDist) {
      bestDist = dist
      bestIndex = i
    }
  }

  return { index: bestIndex, color: palette[bestIndex] }
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
// EGX-Aware Dithering
// ============================================================================

/**
 * Floyd-Steinberg dithering adapted for EGX mode.
 * Each line uses its own sub-palette based on EGX constraints.
 *
 * The key difference from standard dithering:
 * - Standard: dither with full palette, then re-quantize to sub-palette (double quantization)
 * - EGX-aware: dither directly with the sub-palette for each line (single quantization)
 *
 * This produces better results because the error diffusion is computed
 * with the actual colors available for each line.
 */
function applyEGXDithering(
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

      // Get current pixel with accumulated error
      const r = Math.max(0, Math.min(255, errorBuffer[idx3]))
      const g = Math.max(0, Math.min(255, errorBuffer[idx3 + 1]))
      const b = Math.max(0, Math.min(255, errorBuffer[idx3 + 2]))

      // Find closest color in the sub-palette for this line
      const { color } = findClosestInSubset([r, g, b], palette, maxColorIndex)

      // Output the quantized color
      output[idx4] = color[0]
      output[idx4 + 1] = color[1]
      output[idx4 + 2] = color[2]
      output[idx4 + 3] = 255

      // Calculate quantization error
      const errR = r - color[0]
      const errG = g - color[1]
      const errB = b - color[2]

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

  const matrix =
    matrixSize === 2 ? BAYER_2X2 : matrixSize === 4 ? BAYER_4X4 : BAYER_8X8
  // Divisor is size * size (same as original algorithm)
  const divisor = matrixSize * matrixSize

  for (let y = 0; y < height; y++) {
    const lineMode = getModeForLine(y, config)
    const maxColorIndex = getMaxColorIndex(lineMode, config.type)

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      // Match original algorithm: (bayerVal / divisor - 0.5) * intensity * 255
      const bayerVal = matrix[y % matrixSize][x % matrixSize]
      const threshold = (bayerVal / divisor - 0.5) * intensity * 255

      const r = Math.max(0, Math.min(255, data[idx] + threshold))
      const g = Math.max(0, Math.min(255, data[idx + 1] + threshold))
      const b = Math.max(0, Math.min(255, data[idx + 2] + threshold))

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

      const r = Math.max(0, Math.min(255, errorBuffer[idx3]))
      const g = Math.max(0, Math.min(255, errorBuffer[idx3 + 1]))
      const b = Math.max(0, Math.min(255, errorBuffer[idx3 + 2]))

      const { color } = findClosestInSubset([r, g, b], palette, maxColorIndex)

      output[idx4] = color[0]
      output[idx4 + 1] = color[1]
      output[idx4 + 2] = color[2]
      output[idx4 + 3] = 255

      const errR = r - color[0]
      const errG = g - color[1]
      const errB = b - color[2]

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
// EGX Palette from Standard Quantizer
// ============================================================================

/**
 * Use the standard quantizer's palette for EGX.
 * Optimizes the palette so that the most used colors on high-res lines
 * are in the shared slots (INK 0-3 for EGX1, INK 0-1 for EGX2).
 * Locked colors are preserved at their positions.
 *
 * EGX1 needs 16 colors, EGX2 needs 4 colors.
 */
export const egxPaletteAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const config = get(egxConfigAtom)
  const standardPalette = await get(exportPaletteWithSlotsAtom)
  const normalizedImage = await get(egxNormalizedImageAtom)
  const userPalette = get(userPaletteAtom)

  if (!standardPalette || standardPalette.length === 0) {
    logger.warn('[EGX] No standard palette available')
    return null
  }

  // Filter out invalid colors ([-1,-1,-1] slots)
  const validColors = standardPalette.filter(
    (c): c is Vector<'RGB'> => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
  )

  const neededColors = config.type === 'egx1' ? 16 : 4
  const sharedCount = getSharedColorCount(config.type)

  // Identify locked slot indices (within neededColors range)
  const lockedIndices = new Set<number>()
  for (let i = 0; i < neededColors; i++) {
    if (userPalette[i]?.locked && userPalette[i]?.color) {
      lockedIndices.add(i)
    }
  }

  // Build initial palette with locked colors at their positions
  const colors: Vector<'RGB'>[] = new Array(neededColors).fill(null)

  // Place locked colors first
  for (const idx of lockedIndices) {
    const lockedColor = userPalette[idx]?.color
    if (lockedColor) {
      colors[idx] = lockedColor as Vector<'RGB'>
    }
  }

  // Fill remaining slots with non-locked colors from validColors
  let validIdx = 0
  for (let i = 0; i < neededColors; i++) {
    if (colors[i] === null) {
      // Find next valid color that's not a duplicate of a locked color
      while (validIdx < validColors.length) {
        const color = validColors[validIdx]
        validIdx++
        // Check if this color is too similar to any locked color
        const isSimilarToLocked = [...lockedIndices].some((lockedIdx) => {
          const locked = colors[lockedIdx]
          if (!locked) return false
          return colorDistanceSquared(color, locked) < 100 // Very similar
        })
        if (!isSimilarToLocked) {
          colors[i] = color
          break
        }
      }
      // If we ran out of colors, use black
      if (colors[i] === null) {
        colors[i] = [0, 0, 0]
      }
    }
  }

  // Optimize palette for high-res lines, but preserve locked positions
  if (
    normalizedImage &&
    colors.length > sharedCount &&
    lockedIndices.size === 0
  ) {
    // Only reorder if no colors are locked (to preserve user's explicit choices)
    const colorUsage = analyzeHighResLineColors(normalizedImage, colors, config)
    const optimizedColors = optimizePaletteForEGX(
      colors,
      colorUsage,
      sharedCount
    )

    // Copy optimized colors back
    for (let i = 0; i < optimizedColors.length; i++) {
      colors[i] = optimizedColors[i]
    }

    logger.info('[EGX] Palette optimized for high-res lines', {
      sharedCount,
      topColors: colors.slice(0, sharedCount).map((c) => `rgb(${c.join(',')})`)
    })
  } else if (lockedIndices.size > 0) {
    logger.info('[EGX] Palette has locked colors, skipping optimization', {
      lockedIndices: [...lockedIndices]
    })
  }

  logger.info('[EGX] Palette from standard quantizer', {
    validColorsCount: validColors.length,
    neededColors,
    sharedCount,
    lockedCount: lockedIndices.size
  })

  return {
    colors,
    sharedColorCount: sharedCount,
    stats: {
      colorsUsedLowMode: neededColors,
      colorsUsedHighMode: sharedCount,
      avgErrorLowMode: 0,
      avgErrorHighMode: 0,
      totalError: 0
    }
  }
})

/**
 * Display palette for EGX mode (for ColorPalette component).
 * Returns the reordered EGX palette as PaletteSlot array.
 * Preserves locked colors from userPaletteAtom.
 */
export const egxDisplayPaletteAtom = atom(
  async (get): Promise<PaletteSlot[]> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return []

    const paletteInfo = await get(egxPaletteAtom)
    const userPalette = get(userPaletteAtom)
    if (!paletteInfo) return []

    const { colors: egxColors } = paletteInfo
    const neededColors = egxColors.length

    // Collect locked colors to filter them from EGX colors
    const lockedColors: Vector<'RGB'>[] = []
    for (let i = 0; i < 16; i++) {
      const slot = userPalette[i]
      if (slot?.locked && slot?.color) {
        lockedColors.push(slot.color as Vector<'RGB'>)
      }
    }

    // Filter EGX colors to exclude those too similar to locked colors
    const availableEgxColors = egxColors.filter((color) => {
      return !lockedColors.some(
        (locked) => colorDistanceSquared(color, locked) < 100
      )
    })

    // Build display slots, preserving locked colors from user palette
    const slots: PaletteSlot[] = []
    let egxColorIndex = 0

    for (let i = 0; i < 16; i++) {
      const userSlot = userPalette[i]

      if (userSlot?.locked) {
        // Slot is locked: keep user's color and locked state
        slots.push({ ...userSlot })
      } else if (
        i < neededColors &&
        egxColorIndex < availableEgxColors.length
      ) {
        // Slot is not locked: use EGX optimized color (filtered)
        slots.push({
          color: availableEgxColors[egxColorIndex] as Vector<'RGB'>,
          locked: false
        })
        egxColorIndex++
      } else {
        // No more colors available
        slots.push({ color: null, locked: false })
      }
    }

    return slots
  }
)

// ============================================================================
// EGX Preview Image Helpers
// ============================================================================

function shouldGrayOut(previewMode: string, isLowResLine: boolean): boolean {
  return (
    (previewMode === 'lowLines' && !isLowResLine) ||
    (previewMode === 'highLines' && isLowResLine)
  )
}

// ============================================================================
// EGX Preview Image
// ============================================================================

/**
 * Apply EGX-aware dithering based on the dithering mode.
 * Routes to the appropriate EGX dithering function.
 * Also enforces pixel grouping on low-res lines.
 */
function applyEGXDitheringByMode(
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
      result = applyEGXDithering(imageData, palette, config, intensity)
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
      logger.warn(
        `[EGX] Dithering mode '${mode}' not yet EGX-optimized, using Floyd-Steinberg`
      )
      result = applyEGXDithering(imageData, palette, config, intensity)
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

/**
 * Generate EGX preview using EGX-aware dithering.
 *
 * Key improvement: The dithering is done with line-by-line palette constraints,
 * so error diffusion is computed with the actual colors available for each line.
 * This avoids the "double quantization" problem of the previous approach.
 *
 * Uses egxNormalizedImageAtom for correct EGX dimensions:
 * - EGX1: 320×200 (or overscan/custom equivalent)
 * - EGX2: 640×200 (or overscan/custom equivalent)
 */
export const egxPreviewImageAtom = atom(
  async (get): Promise<ImageData | null> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return null

    const config = get(egxConfigAtom)
    const paletteInfo = await get(egxPaletteAtom)
    const normalized = await get(egxNormalizedImageAtom)
    const dithering = get(ditheringAtom)

    if (!paletteInfo || !normalized) {
      logger.warn('[EGX] Missing dependencies for preview')
      return null
    }

    const previewMode = get(egxPreviewModeAtom)
    const { colors: palette } = paletteInfo

    const width = normalized.width
    const height = normalized.height

    logger.info('[EGX] Generating preview with EGX-aware dithering', {
      mode: previewMode,
      ditheringMode: dithering.mode,
      type: config.type,
      dimensions: `${width}x${height}`,
      paletteSize: palette.length
    })

    // Apply EGX-aware dithering (respects line palette constraints during dithering)
    const ditheredBuffer = applyEGXDitheringByMode(
      normalized,
      palette,
      config,
      dithering.mode,
      dithering.intensity
    )

    // If preview mode requires masking lines, apply it
    if (previewMode === 'lowLines' || previewMode === 'highLines') {
      const output = new Uint8ClampedArray(ditheredBuffer)

      for (let y = 0; y < height; y++) {
        const isLowResLine =
          (config.firstLineMode === 'low' && y % 2 === 0) ||
          (config.firstLineMode === 'high' && y % 2 !== 0)

        if (shouldGrayOut(previewMode, isLowResLine)) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4
            output[idx] = 0
            output[idx + 1] = 0
            output[idx + 2] = 0
          }
        }
      }

      return new ImageData(output, width, height)
    }

    return new ImageData(ditheredBuffer, width, height)
  }
)

// ============================================================================
// EGX Index Buffer for Editor
// ============================================================================

/**
 * Generate EGX index buffer for the preview editor.
 * Maps each pixel to its palette index, respecting EGX line constraints.
 */
export const egxIndexBufferAtom = atom(
  async (
    get
  ): Promise<{
    buffer: Uint8Array
    width: number
    height: number
    palette: Vector<'RGB'>[]
  } | null> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return null

    const config = get(egxConfigAtom)
    const paletteInfo = await get(egxPaletteAtom)
    const normalized = await get(egxNormalizedImageAtom)
    const dithering = get(ditheringAtom)

    if (!paletteInfo || !normalized) {
      return null
    }

    const { colors: palette } = paletteInfo
    const width = normalized.width
    const height = normalized.height

    // Apply EGX-aware dithering to get the RGBA buffer
    const ditheredBuffer = applyEGXDitheringByMode(
      normalized,
      palette,
      config,
      dithering.mode,
      dithering.intensity
    )

    // Convert RGBA to index buffer
    // On low-res lines, pixels are grouped by 2 and must have the same color
    const indexBuffer = new Uint8Array(width * height)

    // High-res mode for this EGX type (Mode 1 for EGX1, Mode 2 for EGX2)
    const highResMode = config.type === 'egx1' ? 1 : 2

    for (let y = 0; y < height; y++) {
      const lineMode = getModeForLine(y, config)
      const maxColorIndex = getMaxColorIndex(lineMode, config.type)
      const isLowResLine = lineMode !== highResMode

      // On low-res lines, process pixels in pairs
      const step = isLowResLine ? 2 : 1

      for (let x = 0; x < width; x += step) {
        if (isLowResLine && x + 1 < width) {
          // Low-res line: average the two pixels and use same color for both
          const pixelIdx1 = y * width + x
          const pixelIdx2 = y * width + x + 1
          const rgbaIdx1 = pixelIdx1 * 4
          const rgbaIdx2 = pixelIdx2 * 4

          // Average the two pixels
          const avgPixel: Vector<'RGB'> = [
            Math.round(
              (ditheredBuffer[rgbaIdx1] + ditheredBuffer[rgbaIdx2]) / 2
            ),
            Math.round(
              (ditheredBuffer[rgbaIdx1 + 1] + ditheredBuffer[rgbaIdx2 + 1]) / 2
            ),
            Math.round(
              (ditheredBuffer[rgbaIdx1 + 2] + ditheredBuffer[rgbaIdx2 + 2]) / 2
            )
          ]

          // Find index in sub-palette
          const { index } = findClosestInSubset(
            avgPixel,
            palette,
            maxColorIndex
          )

          // Assign same index to both pixels
          indexBuffer[pixelIdx1] = index
          indexBuffer[pixelIdx2] = index
        } else {
          // High-res line or last pixel on odd-width low-res line
          const pixelIdx = y * width + x
          const rgbaIdx = pixelIdx * 4

          const pixel: Vector<'RGB'> = [
            ditheredBuffer[rgbaIdx],
            ditheredBuffer[rgbaIdx + 1],
            ditheredBuffer[rgbaIdx + 2]
          ]

          // Find index in sub-palette
          const { index } = findClosestInSubset(pixel, palette, maxColorIndex)
          indexBuffer[pixelIdx] = index
        }
      }
    }

    return {
      buffer: indexBuffer,
      width,
      height,
      palette
    }
  }
)

// ============================================================================
// Final EGX Atoms (with manual edits applied)
// ============================================================================

/**
 * Final EGX index buffer with manual edits applied.
 * This is the buffer that should be used for export in EGX mode.
 */
export const finalEgxIndexBufferAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const baseData = await get(egxIndexBufferAtom)
  if (!baseData) return null

  const edits = get(manualPixelEditsAtom)
  return applyManualEditsToBuffer(baseData, edits)
})

/**
 * Final EGX preview ImageData with manual edits applied.
 * Converts the finalEgxIndexBufferAtom to ImageData for display.
 * Also applies the preview mode masking (lowLines/highLines).
 */
export const finalEgxPreviewImageAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const bufferData = await get(finalEgxIndexBufferAtom)
  if (!bufferData) return null

  const { buffer, width, height, palette } = bufferData
  const previewMode = get(egxPreviewModeAtom)
  const config = get(egxConfigAtom)

  // Create ImageData from index buffer and palette
  const imageData = new ImageData(width, height)
  const data = imageData.data

  for (let y = 0; y < height; y++) {
    const isLowResLine =
      (config.firstLineMode === 'low' && y % 2 === 0) ||
      (config.firstLineMode === 'high' && y % 2 !== 0)

    // Check if this line should be masked
    const shouldMask = shouldGrayOut(previewMode, isLowResLine)

    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const pixelIndex = i * 4

      if (shouldMask) {
        // Black out masked lines
        data[pixelIndex] = 0
        data[pixelIndex + 1] = 0
        data[pixelIndex + 2] = 0
      } else {
        const inkIndex = buffer[i]
        const color = palette[inkIndex] ?? [0, 0, 0]
        data[pixelIndex] = color[0]
        data[pixelIndex + 1] = color[1]
        data[pixelIndex + 2] = color[2]
      }
      data[pixelIndex + 3] = 255
    }
  }

  return imageData
})

// ============================================================================
// EGX Export Data
// ============================================================================

/**
 * Export data for EGX mode.
 * Provides all data needed for exporting: index buffer, palette, and config.
 */
export const egxExportDataAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const bufferData = await get(finalEgxIndexBufferAtom)
  const config = get(egxConfigAtom)

  if (!bufferData) return null

  return {
    indexBuffer: bufferData.buffer,
    palette: bufferData.palette,
    width: bufferData.width,
    height: bufferData.height,
    config
  }
})
