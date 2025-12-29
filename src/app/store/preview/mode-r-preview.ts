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
import {
  exportPaletteWithSlotsAtom,
  positionedNormalizedImageAtom
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
 * We use the positionedNormalizedImageAtom (which includes proper margins and
 * positioning like standard modes) and double each pixel horizontally.
 * This ensures Mode R preview has the same aspect ratio and margins as standard modes.
 */

/**
 * Double the horizontal resolution of an image by duplicating each pixel.
 * This preserves the exact colors and margins from the source image.
 */
function doubleHorizontalResolution(sourceImage: ImageData): ImageData {
  const srcWidth = sourceImage.width
  const srcHeight = sourceImage.height
  const dstWidth = srcWidth * 2
  const dstHeight = srcHeight

  const result = new Uint8ClampedArray(dstWidth * dstHeight * 4)

  for (let y = 0; y < srcHeight; y++) {
    for (let x = 0; x < srcWidth; x++) {
      const srcIdx = (y * srcWidth + x) * 4
      const dstIdx = (y * dstWidth + x * 2) * 4

      // Copy pixel to position x*2
      result[dstIdx] = sourceImage.data[srcIdx]
      result[dstIdx + 1] = sourceImage.data[srcIdx + 1]
      result[dstIdx + 2] = sourceImage.data[srcIdx + 2]
      result[dstIdx + 3] = sourceImage.data[srcIdx + 3]

      // Copy pixel to position x*2+1
      result[dstIdx + 4] = sourceImage.data[srcIdx]
      result[dstIdx + 5] = sourceImage.data[srcIdx + 1]
      result[dstIdx + 6] = sourceImage.data[srcIdx + 2]
      result[dstIdx + 7] = sourceImage.data[srcIdx + 3]
    }
  }

  return new ImageData(result, dstWidth, dstHeight)
}

/**
 * Mode R Source Image Atom
 *
 * Creates the source image for Mode R by using the positioned normalized image
 * (which includes proper margins and positioning) and doubling its horizontal
 * resolution by duplicating each pixel.
 *
 * This ensures Mode R has the same visual layout as standard modes.
 */
export const modeRSourceImageAtom = atom(async (get) => {
  const modeREnabled = get(modeREnabledAtom)
  if (!modeREnabled) return null

  // Use the positioned normalized image (same as standard preview pipeline)
  // This includes proper margins, centering, and aspect ratio correction
  const sourceImage = await get(positionedNormalizedImageAtom)
  const modeConfig = get(effectiveModeConfigAtom)

  if (!sourceImage) return null

  // Double the horizontal resolution for Mode R processing
  // Source: 160×200 → Mode R source: 320×200
  const modeRImage = doubleHorizontalResolution(sourceImage)

  logger.info('[Mode R] Source image created from positioned normalized', {
    sourceSize: `${sourceImage.width}×${sourceImage.height}`,
    modeRSize: `${modeRImage.width}×${modeRImage.height}`,
    expectedDimensions: `${modeConfig.width * 2}×${modeConfig.height}`
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
