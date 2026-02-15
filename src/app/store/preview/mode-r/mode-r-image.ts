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

  // In 'origin' mode, use the cropped image BEFORE the standard resize pipeline
  // because the standard pipeline compresses to Mode 0 dimensions (160×200)
  // but Mode R needs the full 320×200 resolution
  // In 'auto' and 'cover' modes, use resizedImageAtom (NOT smoothedImageAtom) to skip horizontal smoothing
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
  // - auto/cover: fit with aspect ratio preservation (cover already cropped by resizedImageAtom)
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
