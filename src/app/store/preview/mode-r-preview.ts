/**
 * Mode R Preview Atoms
 *
 * Handles the dual-image interlaced rendering pipeline for Mode R.
 * Mode R doubles horizontal resolution by alternating two images at 50Hz
 * with line-by-line interlaced pixel extraction.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type {
  ModeRConfig,
  ModeRQuantizationResult
} from '@/libs/pixsaur-mode-r'
import {
  generateBlendedPreview,
  generateFlickerHeatmap,
  generateFrameAPreview,
  generateFrameBPreview,
  quantizeModeR
} from '@/libs/pixsaur-mode-r'
import { applyResize, type Selection } from '@/source'
import {
  centerImageAtom,
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  modeRAntiFlickerAtom,
  modeRDualPaletteAtom,
  modeREnabledAtom,
  modeRMaxLuminanceDeltaAtom,
  modeRPreviewModeAtom,
  resizeModeAtom
} from '../config/config'
import {
  croppedImageAtom,
  exportPaletteWithSlotsAtom,
  resizedImageAtom
} from './preview'

// ============================================================================
// Mode R Configuration Atom
// ============================================================================

/**
 * Derived Mode R configuration from individual settings
 */
export const modeRConfigAtom = atom((get): ModeRConfig => {
  const antiFlickerWeight = get(modeRAntiFlickerAtom)
  const maxLuminanceDelta = get(modeRMaxLuminanceDeltaAtom)
  const hardware = get(cpcHardwareAtom)
  const dithering = get(ditheringAtom)
  const useDualPalette = get(modeRDualPaletteAtom)

  // Use the same dithering intensity as standard mode (0-1 range → 0-100)
  const ditheringEnabled = dithering.mode !== 'none'
  const ditheringIntensity = ditheringEnabled
    ? Math.round(dithering.intensity * 100)
    : 0

  return {
    antiFlickerWeight,
    maxLuminanceDelta,
    targetHardware: hardware,
    // Pass the actual dithering mode from settings
    ditheringMode: ditheringEnabled ? dithering.mode : 'none',
    ditheringIntensity,
    useDualPalette
  }
})

// ============================================================================
// Mode R Source Image (True High Resolution)
// ============================================================================

/**
 * Resize image to Mode R target dimensions for AUTO mode (2× horizontal resolution)
 *
 * Unlike standard modes which resize to modeConfig dimensions (e.g., 160×200 for Mode 0),
 * Mode R needs the source at doubled horizontal resolution (e.g., 320×200) to have
 * actual different pixels for the interlaced extraction.
 *
 * IMPORTANT: Mode R perceives 320×200 with SQUARE pixels (not 2:1 like Mode 0).
 * So we resize with 1:1 aspect ratio, not the Mode 0 pixel aspect ratio.
 */
export function resizeForModeRAuto(
  src: ImageData,
  targetWidth: number,
  targetHeight: number,
  center: boolean
): ImageData {
  // Mode R target (320×200) has SQUARE perceived pixels
  // No aspect ratio correction needed - just fit the image into 320×200
  const scale = Math.min(targetWidth / src.width, targetHeight / src.height)
  const scaledW = Math.round(src.width * scale)
  const scaledH = Math.round(src.height * scale)

  if (scaledW === 0 || scaledH === 0) {
    // Return empty image at target size
    return new ImageData(targetWidth, targetHeight)
  }

  // Create temporary canvas for the source
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = src.width
  srcCanvas.height = src.height
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.putImageData(src, 0, 0)

  // Create output canvas at full target dimensions
  const outCanvas = document.createElement('canvas')
  outCanvas.width = targetWidth
  outCanvas.height = targetHeight
  const outCtx = outCanvas.getContext('2d')!
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'

  // Fill with black (for margins if any)
  outCtx.fillStyle = 'black'
  outCtx.fillRect(0, 0, targetWidth, targetHeight)

  // Calculate position (centered if requested, otherwise top-left)
  let offsetX = 0
  let offsetY = 0
  if (center) {
    offsetX = Math.floor((targetWidth - scaledW) / 2)
    offsetY = Math.floor((targetHeight - scaledH) / 2)
  }

  // Draw scaled image at calculated position
  outCtx.drawImage(
    srcCanvas,
    0,
    0,
    src.width,
    src.height,
    offsetX,
    offsetY,
    scaledW,
    scaledH
  )

  return outCtx.getImageData(0, 0, targetWidth, targetHeight)
}

/**
 * Resize image to Mode R target dimensions for ORIGIN mode
 *
 * In origin mode, Mode R behaves like Mode 1: pixel-perfect 1:1 mapping.
 * Reuses the standard applyResize with a Mode 1-like config (pixelRatio = 1).
 */
export function resizeForModeROrigin(
  src: ImageData,
  targetWidth: number,
  targetHeight: number,
  center: boolean
): ImageData {
  // Create canvas from ImageData
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = src.width
  srcCanvas.height = src.height
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.putImageData(src, 0, 0)

  // Create a Mode 1-like config for Mode R (320×200 with 1:1 pixel ratio)
  // This makes applyResize behave exactly like Mode 1 origin
  const modeRConfig = {
    mode: 'origin' as const,
    modeConfig: {
      width: targetWidth, // 320
      height: targetHeight, // 200
      scaleX: 1, // Square pixels (like Mode 1)
      scaleY: 1,
      mode: 1 as const,
      nColors: 16,
      overscan: false
    }
  }

  // Use full source as selection
  const selection: Selection = {
    sx: 0,
    sy: 0,
    width: src.width,
    height: src.height
  }

  // Reuse standard resize logic
  const resultCanvas = applyResize(srcCanvas, selection, modeRConfig, center)
  const resultCtx = resultCanvas.getContext('2d')!

  return resultCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height)
}

/**
 * Mode R Source Image Atom
 *
 * Creates the source image for Mode R at TRUE doubled horizontal resolution.
 *
 * This is critical for Mode R to work correctly:
 * - Standard Mode 0 resize: source → 160×200 (each Mode 0 pixel = 2 screen pixels)
 * - Mode R needs: source → 320×200 (each source pixel = 1 perceived sub-pixel)
 *
 * The interlacing then extracts:
 * - Frame A: pixels 0, 2, 4... → 160 pixels per line
 * - Frame B: pixels 1, 3, 5... → 160 pixels per line
 *
 * When displayed with horizontal shifts, the eye perceives all 320 different colors.
 */
export const modeRSourceImageAtom = atom(async (get) => {
  const modeREnabled = get(modeREnabledAtom)
  if (!modeREnabled) return null

  const modeConfig = get(effectiveModeConfigAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)

  // In 'origin' mode, use the cropped image BEFORE the standard resize pipeline
  // because the standard pipeline compresses to Mode 0 dimensions (160×200)
  // but Mode R needs the full 320×200 resolution
  // In 'auto' mode, use resizedImageAtom (NOT smoothedImageAtom) to skip horizontal smoothing
  // Mode R has its own sub-pixel resolution, horizontal smoothing would blur it
  const sourceImage =
    resizeMode === 'origin'
      ? await get(croppedImageAtom)
      : await get(resizedImageAtom)

  if (!sourceImage) return null

  // Target dimensions for Mode R: doubled horizontal resolution
  const targetWidth = modeConfig.width * 2 // 320 for standard Mode 0
  const targetHeight = modeConfig.height // 200 for standard

  // Skip resize if in 'origin' mode and image already matches target
  if (
    resizeMode === 'origin' &&
    sourceImage.width === targetWidth &&
    sourceImage.height === targetHeight
  ) {
    logger.info(
      '[Mode R] Using source image directly (origin mode, correct size)',
      {
        size: `${sourceImage.width}×${sourceImage.height}`
      }
    )
    return sourceImage
  }

  // Resize to Mode R target dimensions
  // Use different resize strategy based on resize mode:
  // - origin: pixel-perfect 1:1 mapping (like Mode 1)
  // - auto: fit with aspect ratio preservation
  const modeRImage =
    resizeMode === 'origin'
      ? resizeForModeROrigin(
          sourceImage,
          targetWidth,
          targetHeight,
          centerImage
        )
      : resizeForModeRAuto(sourceImage, targetWidth, targetHeight, centerImage)

  logger.info('[Mode R] Source image resized to true high resolution', {
    sourceSize: `${sourceImage.width}×${sourceImage.height}`,
    modeRSize: `${modeRImage.width}×${modeRImage.height}`,
    targetDimensions: `${targetWidth}×${targetHeight}`
  })

  return modeRImage
})

// ============================================================================
// Mode R Quantization Result
// ============================================================================

/**
 * Mode R quantization result with dual index buffers and palettes
 */
export const modeRQuantizationAtom = atom(
  async (get): Promise<ModeRQuantizationResult | null> => {
    const modeREnabled = get(modeREnabledAtom)
    if (!modeREnabled) return null

    const sourceImage = await get(modeRSourceImageAtom)
    const exportPalette = await get(exportPaletteWithSlotsAtom)
    const config = get(modeRConfigAtom)

    if (!sourceImage || exportPalette.length === 0) return null

    // Filter out ignored slots
    const validPalette = exportPalette.filter(
      (c): c is Vector<'RGB'> => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
    )

    if (validPalette.length === 0) return null

    logger.info('[Mode R] Starting quantization', {
      imageSize: `${sourceImage.width}×${sourceImage.height}`,
      paletteSize: validPalette.length,
      config
    })

    // Pass the existing palette from standard mode as palette A base
    // This preserves important colors like bright yellow that standard mode captured
    const result = quantizeModeR(
      sourceImage.data,
      sourceImage.width,
      sourceImage.height,
      config,
      validPalette
    )

    logger.info('[Mode R] Quantization complete', {
      outputSize: `${Math.floor(sourceImage.width / 2)}×${sourceImage.height}`,
      averageFlicker: result.palettes.stats.averageFlicker.toFixed(2),
      maxFlicker: result.palettes.stats.maxFlicker.toFixed(2),
      noFlickerPairs: result.palettes.stats.noFlickerPairs
    })

    return result
  }
)

// ============================================================================
// Mode R Preview Images
// ============================================================================

/**
 * Mode R preview image based on selected preview mode
 */
export const modeRPreviewImageAtom = atom(
  async (get): Promise<ImageData | null> => {
    const modeREnabled = get(modeREnabledAtom)
    if (!modeREnabled) {
      logger.info('[Mode R] Preview skipped - Mode R not enabled')
      return null
    }

    const quantResult = await get(modeRQuantizationAtom)
    if (!quantResult) {
      logger.warn('[Mode R] Preview skipped - No quantization result')
      return null
    }

    const previewMode = get(modeRPreviewModeAtom)
    const { indexBufferA, indexBufferB, palettes } = quantResult

    // Output dimensions (Mode 0 resolution)
    // Get dimensions from mode config
    const modeConfig = get(effectiveModeConfigAtom)
    const height = modeConfig.height
    const actualWidth = modeConfig.width

    logger.info('[Mode R] Generating preview', {
      previewMode,
      height,
      actualWidth,
      bufferLength: quantResult.indexBufferA.length,
      paletteALength: palettes.paletteA.length,
      paletteBLength: palettes.paletteB.length
    })

    let previewData: Uint8ClampedArray

    switch (previewMode) {
      case 'frameA':
        previewData = generateFrameAPreview(
          indexBufferA,
          actualWidth,
          height,
          palettes
        )
        break

      case 'frameB':
        previewData = generateFrameBPreview(
          indexBufferB,
          actualWidth,
          height,
          palettes
        )
        break

      case 'flicker':
        previewData = generateFlickerHeatmap(
          indexBufferA,
          indexBufferB,
          actualWidth,
          height,
          palettes
        )
        break

      case 'blended':
      default:
        previewData = generateBlendedPreview(
          indexBufferA,
          indexBufferB,
          actualWidth,
          height,
          palettes
        )
        break
    }

    // For blended preview, output is at doubled resolution
    // frameA, frameB, and flicker show Mode 0 resolution (160×200)
    const isBlendedMode = previewMode === 'blended' || previewMode === undefined
    const outputWidth = isBlendedMode ? actualWidth * 2 : actualWidth

    logger.info('[Mode R] Preview generated', {
      outputWidth,
      height,
      dataLength: previewData.length
    })

    return new ImageData(
      new Uint8ClampedArray(previewData),
      outputWidth,
      height
    )
  }
)

// ============================================================================
// Mode R Export Data
// ============================================================================

/**
 * Export data for Mode R (two images + two palettes)
 */
export const modeRExportDataAtom = atom(async (get) => {
  const modeREnabled = get(modeREnabledAtom)
  if (!modeREnabled) return null

  const quantResult = await get(modeRQuantizationAtom)
  if (!quantResult) return null

  return {
    indexBufferA: quantResult.indexBufferA,
    indexBufferB: quantResult.indexBufferB,
    paletteA: quantResult.palettes.paletteA,
    paletteB: quantResult.palettes.paletteB,
    stats: quantResult.palettes.stats
  }
})
