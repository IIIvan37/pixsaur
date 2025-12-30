/**
 * EGX Preview Atoms
 *
 * Handles the line-by-line mode alternation preview pipeline for EGX.
 * EGX alternates video modes per line (spatial interlacing, no flicker).
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import type { EGXConfig, EGXQuantizationResult } from '@/libs/pixsaur-egx'
import {
  generateEGXPreview,
  getEGXOutputDimensions,
  quantizeEGX
} from '@/libs/pixsaur-egx'
import {
  cpcHardwareAtom,
  ditheringAtom,
  egxEnabledAtom,
  egxFirstLineModeAtom,
  egxPreviewModeAtom,
  egxTypeAtom,
  egxVerticalDitherAttenuationAtom
} from '../config/config'
import { resizedImageAtom } from './preview'

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
// EGX Source Image
// ============================================================================

/**
 * EGX Source Image Atom
 *
 * Resizes the source image to EGX target dimensions:
 * - EGX1: 320×200 (Mode 1 resolution)
 * - EGX2: 640×200 (Mode 2 resolution)
 */
export const egxSourceImageAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const config = get(egxConfigAtom)
  const sourceImage = await get(resizedImageAtom)

  if (!sourceImage) return null

  const targetDims = getEGXOutputDimensions(config.type)

  // If source already matches target, use directly
  if (
    sourceImage.width === targetDims.width &&
    sourceImage.height === targetDims.height
  ) {
    logger.info('[EGX] Using source image directly (correct size)', {
      size: `${sourceImage.width}×${sourceImage.height}`
    })
    return sourceImage
  }

  // Simple resize using canvas
  const resizedImage = resizeToEGXDimensions(
    sourceImage,
    targetDims.width,
    targetDims.height
  )

  logger.info('[EGX] Source image resized', {
    sourceSize: `${sourceImage.width}×${sourceImage.height}`,
    egxSize: `${resizedImage.width}×${resizedImage.height}`
  })

  return resizedImage
})

/**
 * Resize image to EGX target dimensions
 */
function resizeToEGXDimensions(
  src: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  // Create canvas from source
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = src.width
  srcCanvas.height = src.height
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.putImageData(src, 0, 0)

  // Create output canvas
  const outCanvas = document.createElement('canvas')
  outCanvas.width = targetWidth
  outCanvas.height = targetHeight
  const outCtx = outCanvas.getContext('2d')!
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'

  // Calculate scale to fit
  const scale = Math.min(targetWidth / src.width, targetHeight / src.height)
  const scaledW = Math.round(src.width * scale)
  const scaledH = Math.round(src.height * scale)

  // Center in output
  const offsetX = Math.floor((targetWidth - scaledW) / 2)
  const offsetY = Math.floor((targetHeight - scaledH) / 2)

  // Fill with black
  outCtx.fillStyle = 'black'
  outCtx.fillRect(0, 0, targetWidth, targetHeight)

  // Draw scaled
  outCtx.drawImage(srcCanvas, offsetX, offsetY, scaledW, scaledH)

  return outCtx.getImageData(0, 0, targetWidth, targetHeight)
}

// ============================================================================
// EGX Quantization Result
// ============================================================================

/**
 * EGX quantization result atom
 */
export const egxQuantizationAtom = atom(
  async (get): Promise<EGXQuantizationResult | null> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return null

    const sourceImage = await get(egxSourceImageAtom)
    const config = get(egxConfigAtom)

    if (!sourceImage) return null

    logger.info('[EGX] Starting quantization', {
      imageSize: `${sourceImage.width}×${sourceImage.height}`,
      type: config.type,
      firstLineMode: config.firstLineMode
    })

    const result = quantizeEGX(
      sourceImage.data,
      sourceImage.width,
      sourceImage.height,
      config
    )

    logger.info('[EGX] Quantization complete', {
      outputSize: `${result.width}×${result.height}`,
      paletteSize: result.palette.colors.length,
      sharedColors: result.palette.sharedColorCount,
      totalError: Math.round(result.totalError)
    })

    return result
  }
)

// ============================================================================
// EGX Palette Atom (for UI display)
// ============================================================================

/**
 * Derived atom exposing just the palette for UI display
 */
export const egxPaletteAtom = atom(async (get) => {
  const quantResult = await get(egxQuantizationAtom)
  if (!quantResult) return null

  return {
    colors: quantResult.palette.colors,
    sharedColorCount: quantResult.palette.sharedColorCount,
    stats: quantResult.palette.stats
  }
})

// ============================================================================
// EGX Preview Image
// ============================================================================

/**
 * EGX preview image based on selected preview mode
 */
export const egxPreviewImageAtom = atom(
  async (get): Promise<ImageData | null> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) {
      return null
    }

    const quantResult = await get(egxQuantizationAtom)
    if (!quantResult) {
      logger.warn('[EGX] Preview skipped - No quantization result')
      return null
    }

    const previewMode = get(egxPreviewModeAtom)

    logger.info('[EGX] Generating preview', {
      mode: previewMode,
      size: `${quantResult.width}×${quantResult.height}`
    })

    // Generate preview based on mode
    const previewData = generateEGXPreview(quantResult, previewMode)

    return new ImageData(
      new Uint8ClampedArray(previewData),
      quantResult.width,
      quantResult.height
    )
  }
)
