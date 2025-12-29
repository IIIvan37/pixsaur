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
  modeRAntiFlickerAtom,
  modeREnabledAtom,
  modeRMaxLuminanceDeltaAtom,
  modeRPreviewModeAtom
} from '../config/config'
import { exportPaletteWithSlotsAtom, normalizedImageAtom } from './preview'

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

  return {
    antiFlickerWeight,
    maxLuminanceDelta,
    targetHardware: hardware
  }
})

// ============================================================================
// Mode R Source Image (Doubled Horizontal Resolution)
// ============================================================================

/**
 * Source image for Mode R at doubled horizontal resolution.
 * Mode R requires input at 2× horizontal resolution to extract interlaced pixels.
 *
 * For standard Mode 0 (160×200), input should be 320×200.
 * For overscan Mode 0 (192×272), input should be 384×272.
 */
export const modeRSourceImageAtom = atom(async (get) => {
  const modeREnabled = get(modeREnabledAtom)
  if (!modeREnabled) return null

  // Use the normalized image which is at CPC resolution
  // For Mode R, we need the image BEFORE it's scaled down to Mode 0
  // This means we need a version at 2× horizontal resolution
  const normalizedImage = await get(normalizedImageAtom)

  if (!normalizedImage) return null

  // The normalized image is already at CPC Mode 0 dimensions (160×200)
  // For Mode R, we ideally want 320×200 to extract interlaced pixels
  // For now, we'll use the normalized image and let quantizeModeR handle it
  // by treating each pixel as providing 2 sub-pixels (same color repeated)
  //
  // Future enhancement: Create a separate resize pipeline that outputs
  // at 2× horizontal resolution, or accept higher resolution source

  // Create a doubled-resolution version by duplicating pixels horizontally
  const width = normalizedImage.width
  const height = normalizedImage.height
  const doubledWidth = width * 2

  const doubledImage = new ImageData(doubledWidth, height)
  const srcData = normalizedImage.data
  const dstData = doubledImage.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4
      const dstIdx1 = (y * doubledWidth + x * 2) * 4
      const dstIdx2 = (y * doubledWidth + x * 2 + 1) * 4

      // Duplicate pixel to both positions
      for (let c = 0; c < 4; c++) {
        dstData[dstIdx1 + c] = srcData[srcIdx + c]
        dstData[dstIdx2 + c] = srcData[srcIdx + c]
      }
    }
  }

  logger.info('[Mode R] Source image created', {
    originalSize: `${width}×${height}`,
    doubledSize: `${doubledWidth}×${height}`
  })

  return doubledImage
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
      validPalette,
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
    if (!modeREnabled) return null

    const quantResult = await get(modeRQuantizationAtom)
    if (!quantResult) return null

    const previewMode = get(modeRPreviewModeAtom)
    const { indexBufferA, indexBufferB, palettes } = quantResult

    // Output dimensions (Mode 0 resolution)
    // Height is typically 200 (standard) or 272 (overscan)
    // We infer it from the source image dimensions
    const normalizedImage = await get(normalizedImageAtom)
    const height = normalizedImage?.height ?? 200
    const actualWidth = quantResult.indexBufferA.length / height

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
    const outputWidth =
      previewMode === 'blended' ? actualWidth * 2 : actualWidth

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
