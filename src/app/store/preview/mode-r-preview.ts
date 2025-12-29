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
import {
  centerImageAtom,
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  modeRAntiFlickerAtom,
  modeREnabledAtom,
  modeRMaxLuminanceDeltaAtom,
  modeRPreviewModeAtom,
  resizeModeAtom
} from '../config/config'
import { exportPaletteWithSlotsAtom, smoothedImageAtom } from './preview'

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

  // Use the same dithering intensity as standard mode (0-1 range → 0-100)
  const ditheringEnabled = dithering.mode !== 'none'
  const ditheringIntensity = ditheringEnabled
    ? Math.round(dithering.intensity * 100)
    : 0

  return {
    antiFlickerWeight,
    maxLuminanceDelta,
    targetHardware: hardware,
    ditheringMode: ditheringEnabled ? 'floyd-steinberg' : 'none',
    ditheringIntensity
  }
})

// ============================================================================
// Mode R Source Image (True High Resolution)
// ============================================================================

/**
 * Resize image to Mode R target dimensions (2× horizontal resolution)
 *
 * Unlike standard modes which resize to modeConfig dimensions (e.g., 160×200 for Mode 0),
 * Mode R needs the source at doubled horizontal resolution (e.g., 320×200) to have
 * actual different pixels for the interlaced extraction.
 *
 * IMPORTANT: Mode R perceives 320×200 with SQUARE pixels (not 2:1 like Mode 0).
 * So we resize with 1:1 aspect ratio, not the Mode 0 pixel aspect ratio.
 */
function resizeForModeR(
  src: ImageData,
  targetWidth: number,
  targetHeight: number,
  _mode: number,
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

  // Get the source image BEFORE the Mode 0 resize
  // smoothedImageAtom contains the processed image before CPC dimension normalization
  const sourceImage = await get(smoothedImageAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)

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
  const modeRImage = resizeForModeR(
    sourceImage,
    targetWidth,
    targetHeight,
    modeConfig.mode,
    centerImage
  )

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
    const outputWidth =
      previewMode === 'blended' ? actualWidth * 2 : actualWidth

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
