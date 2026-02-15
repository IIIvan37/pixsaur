/**
 * Mode R Image Processing
 *
 * Handles image resizing and normalization for Mode R.
 * Mode R needs 2× horizontal resolution (e.g., 320×200 for standard Mode 0).
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import { applyResize, type Selection } from '@/source'
import {
  centerImageAtom,
  effectiveModeConfigAtom,
  modeREnabledAtom,
  resizeModeAtom
} from '../../config/config'
import { croppedImageAtom, resizedImageAtom } from '../preview'

// ============================================================================
// Resize Functions
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
 * Resize image to Mode R target dimensions for COVER mode
 *
 * Cover mode: Scale the image to fill the target dimensions completely,
 * cropping any excess. The image is centered, so cropping is symmetric.
 * Mode R has SQUARE perceived pixels, so no aspect ratio correction needed.
 *
 * @param src - Source ImageData (from cropped image)
 * @param targetWidth - Target width (e.g., 320 for standard Mode 0 R)
 * @param targetHeight - Target height (e.g., 200 for standard Mode 0 R)
 * @returns ImageData filled with the scaled and cropped image
 */
export function resizeForModeRCover(
  src: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  // Mode R has SQUARE perceived pixels
  const sourceAspect = src.width / src.height
  const targetAspect = targetWidth / targetHeight

  // Create temporary canvas for the source
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = src.width
  srcCanvas.height = src.height
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.putImageData(src, 0, 0)

  // Calculate source region to crop (cover mode)
  let srcX = 0
  let srcY = 0
  let srcW = src.width
  let srcH = src.height

  if (sourceAspect > targetAspect) {
    // Source is wider: crop horizontally
    const newWidth = src.height * targetAspect
    srcX = (src.width - newWidth) / 2
    srcW = newWidth
  } else if (sourceAspect < targetAspect) {
    // Source is taller: crop vertically
    const newHeight = src.width / targetAspect
    srcY = (src.height - newHeight) / 2
    srcH = newHeight
  }

  // Create output canvas at full target dimensions
  const outCanvas = document.createElement('canvas')
  outCanvas.width = targetWidth
  outCanvas.height = targetHeight
  const outCtx = outCanvas.getContext('2d')!
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'

  // Draw cropped and scaled image
  outCtx.drawImage(
    srcCanvas,
    srcX,
    srcY,
    srcW,
    srcH,
    0,
    0,
    targetWidth,
    targetHeight
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

// ============================================================================
// Mode R Source Image Atom
// ============================================================================

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

  // Target dimensions for Mode R: doubled horizontal resolution
  const targetWidth = modeConfig.width * 2 // 320 for standard Mode 0
  const targetHeight = modeConfig.height // 200 for standard

  // Select source image based on resize mode:
  // - 'origin' and 'cover': use cropped image (before resize) to apply Mode R-specific resize
  // - 'auto': use resizedImageAtom (already fit to Mode 0 dimensions, then scaled to Mode R)
  const sourceImage =
    resizeMode === 'origin' || resizeMode === 'cover'
      ? await get(croppedImageAtom)
      : await get(resizedImageAtom)

  if (!sourceImage) return null

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
  // - cover: fill target dimensions, cropping excess (preserves aspect ratio)
  // - auto: fit with aspect ratio preservation (may have margins)
  let modeRImage: ImageData
  if (resizeMode === 'origin') {
    modeRImage = resizeForModeROrigin(
      sourceImage,
      targetWidth,
      targetHeight,
      centerImage
    )
  } else if (resizeMode === 'cover') {
    modeRImage = resizeForModeRCover(sourceImage, targetWidth, targetHeight)
  } else {
    modeRImage = resizeForModeRAuto(
      sourceImage,
      targetWidth,
      targetHeight,
      centerImage
    )
  }

  logger.info('[Mode R] Source image resized to true high resolution', {
    sourceSize: `${sourceImage.width}×${sourceImage.height}`,
    modeRSize: `${modeRImage.width}×${modeRImage.height}`,
    targetDimensions: `${targetWidth}×${targetHeight}`,
    resizeMode
  })

  return modeRImage
})
