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
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  modeRAntiFlickerAtom,
  modeREnabledAtom,
  modeRMaxLuminanceDeltaAtom,
  modeRPreviewModeAtom
} from '../config/config'
import { croppedImageAtom, exportPaletteWithSlotsAtom } from './preview'

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

  return {
    antiFlickerWeight,
    maxLuminanceDelta,
    targetHardware: hardware,
    ditheringMode: dithering ? 'floyd-steinberg' : 'none',
    ditheringIntensity: 100
  }
})

// ============================================================================
// Mode R Source Image (Doubled Horizontal Resolution)
// ============================================================================

/**
 * Source image for Mode R at doubled horizontal resolution.
 * Mode R requires input at 2× horizontal resolution to extract interlaced pixels.
 *
 * IMPORTANT: We resize the ORIGINAL source image to 320×200 (2× Mode 0 width)
 * This preserves the high-resolution detail from the source image.
 * We do NOT simply duplicate pixels from a 160×200 image.
 */

/**
 * Resize source image to Mode R resolution (2× horizontal resolution)
 * This preserves high-resolution detail from the original image.
 */
function resizeToModeRResolution(
  sourceImage: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')

  if (!ctx) return sourceImage

  // Create temp canvas with source image
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = sourceImage.width
  srcCanvas.height = sourceImage.height
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) return sourceImage
  srcCtx.putImageData(sourceImage, 0, 0)

  // Use high-quality scaling to preserve details
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight)

  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}

/**
 * Mode R Source Image Atom
 *
 * Creates a high-resolution source image for Mode R by resizing the ORIGINAL
 * cropped image to 2× the Mode 0 horizontal resolution.
 *
 * This preserves the detail from the source image rather than just duplicating
 * pixels from an already-reduced image.
 */
export const modeRSourceImageAtom = atom(async (get) => {
  const modeREnabled = get(modeREnabledAtom)
  if (!modeREnabled) return null

  // Use the cropped image (before CPC resize) as source
  const sourceImage = await get(croppedImageAtom)
  const modeConfig = get(effectiveModeConfigAtom)

  if (!sourceImage) return null

  // Target dimensions: 2× horizontal resolution of Mode 0
  // Standard Mode 0: 160×200 → Mode R source: 320×200
  // Overscan Mode 0: 192×272 → Mode R source: 384×272
  const targetWidth = modeConfig.width * 2
  const targetHeight = modeConfig.height

  // Resize the original high-resolution image to Mode R dimensions
  const modeRImage = resizeToModeRResolution(
    sourceImage,
    targetWidth,
    targetHeight
  )

  logger.info('[Mode R] Source image created from original', {
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

    const result = quantizeModeR(
      sourceImage.data,
      sourceImage.width,
      sourceImage.height,
      config
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
