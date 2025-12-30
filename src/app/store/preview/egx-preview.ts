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
  egxVerticalDitherAttenuationAtom,
  horizontalSmoothingAtom,
  resizeModeAtom
} from '../config/config'
import { selectionAtom, workingImageAtom } from '../image/image'
import {
  exportPaletteWithSlotsAtom,
  positionImageForAutoMode,
  quantizerAtom
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
  const verticalAttenuation = get(egxVerticalDitherAttenuationAtom)

  const ditheringEnabled = dithering.mode !== 'none'
  const ditheringIntensity = ditheringEnabled
    ? Math.round(dithering.intensity * 100)
    : 0

  return {
    type,
    firstLineMode,
    targetHardware: hardware,
    ditheringMode: ditheringEnabled ? dithering.mode : 'none',
    ditheringIntensity,
    verticalDitherAttenuation: verticalAttenuation
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
// EGX Palette from Standard Quantizer
// ============================================================================

/**
 * Use the standard quantizer's palette for EGX.
 * EGX1 needs 16 colors, EGX2 needs 4 colors.
 */
export const egxPaletteAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const config = get(egxConfigAtom)
  const standardPalette = await get(exportPaletteWithSlotsAtom)

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

  // If we have enough colors, use them
  // If not, pad with black
  const colors: Vector<'RGB'>[] = []
  for (let i = 0; i < neededColors; i++) {
    colors.push(validColors[i] ?? [0, 0, 0])
  }

  logger.info('[EGX] Palette from standard quantizer', {
    validColorsCount: validColors.length,
    neededColors,
    sharedCount
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

// ============================================================================
// EGX Preview Image Helpers
// ============================================================================

function renderModeMapPixel(
  output: Uint8ClampedArray,
  dstIdx: number,
  isLowResLine: boolean
): void {
  if (isLowResLine) {
    output[dstIdx] = 200
    output[dstIdx + 1] = 120
    output[dstIdx + 2] = 50
  } else {
    output[dstIdx] = 50
    output[dstIdx + 1] = 100
    output[dstIdx + 2] = 200
  }
  output[dstIdx + 3] = 255
}

function renderGrayPixel(output: Uint8ClampedArray, dstIdx: number): void {
  output[dstIdx] = 128
  output[dstIdx + 1] = 128
  output[dstIdx + 2] = 128
  output[dstIdx + 3] = 255
}

function renderColorPixel(
  output: Uint8ClampedArray,
  dstIdx: number,
  color: Vector<'RGB'>
): void {
  output[dstIdx] = color[0]
  output[dstIdx + 1] = color[1]
  output[dstIdx + 2] = color[2]
  output[dstIdx + 3] = 255
}

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
 * Generate EGX preview by applying line-by-line constraints
 * to the dithered image from the standard pipeline.
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
    const quantizer = await get(quantizerAtom)
    const normalized = await get(egxNormalizedImageAtom)
    const dithering = get(ditheringAtom)

    if (!paletteInfo || !quantizer || !normalized) {
      logger.warn('[EGX] Missing dependencies for preview')
      return null
    }

    const previewMode = get(egxPreviewModeAtom)
    const { colors: palette } = paletteInfo

    const width = normalized.width
    const height = normalized.height

    logger.info('[EGX] Generating preview', {
      mode: previewMode,
      type: config.type,
      dimensions: `${width}x${height}`,
      paletteSize: palette.length
    })

    // Dither the normalized image with the full palette
    const ditheredBuffer = quantizer.dither(normalized, palette, {
      mode: dithering.mode,
      intensity: dithering.intensity
    })

    // Create output with EGX line constraints
    const output = new Uint8ClampedArray(width * height * 4)

    // Process each line according to its mode constraints
    for (let y = 0; y < height; y++) {
      const lineMode = getModeForLine(y, config)
      const maxColorIndex = getMaxColorIndex(lineMode, config.type)
      const isLowResLine =
        (config.firstLineMode === 'low' && y % 2 === 0) ||
        (config.firstLineMode === 'high' && y % 2 !== 0)

      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4
        const dstIdx = srcIdx

        const ditheredColor: Vector<'RGB'> = [
          ditheredBuffer[srcIdx],
          ditheredBuffer[srcIdx + 1],
          ditheredBuffer[srcIdx + 2]
        ]

        if (previewMode === 'modeMap') {
          renderModeMapPixel(output, dstIdx, isLowResLine)
        } else if (shouldGrayOut(previewMode, isLowResLine)) {
          renderGrayPixel(output, dstIdx)
        } else {
          const { color } = findClosestInSubset(
            ditheredColor,
            palette,
            maxColorIndex
          )
          renderColorPixel(output, dstIdx, color)
        }
      }
    }

    return new ImageData(output, width, height)
  }
)
