/**
 * Image Positioning
 *
 * Functions for positioning images within target dimensions,
 * handling margins, centering, and background color fills.
 */

import { findDarkestValidColor } from '@/domain/cpc/color-utils'
import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * Target dimensions configuration
 */
export interface TargetDimensions {
  width: number
  height: number
}

/**
 * Positioning options
 */
export interface PositioningOptions {
  /** Center the image in the target area */
  center: boolean
  /** Background color for margins (default: darkest from palette) */
  backgroundColor?: Vector
}

/**
 * Position an image within target dimensions
 *
 * If the image is smaller than target, it will be placed with margins
 * filled with the background color (defaults to darkest palette color).
 *
 * @param image - Source ImageData to position
 * @param target - Target dimensions
 * @param palette - Color palette (used to find darkest color for margins)
 * @param options - Positioning options
 * @returns Positioned ImageData at target dimensions
 */
export function positionImage(
  image: ImageData,
  target: TargetDimensions,
  palette: Vector[],
  options: PositioningOptions
): ImageData {
  const { center, backgroundColor } = options
  const { width: targetWidth, height: targetHeight } = target

  // If already at target size, return as-is
  if (image.width === targetWidth && image.height === targetHeight) {
    return image
  }

  // Create canvas at target dimensions
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    // Fallback: return original if canvas context unavailable
    return image
  }

  // Determine background color (darkest from palette or specified)
  const bgColor = backgroundColor ?? findDarkestValidColor(palette)

  // Fill background
  ctx.fillStyle = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  // Calculate position
  const dx = center ? Math.floor((targetWidth - image.width) / 2) : 0
  const dy = center ? Math.floor((targetHeight - image.height) / 2) : 0

  // Draw image via temp canvas (required for ImageData)
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = image.width
  tempCanvas.height = image.height
  const tempCtx = tempCanvas.getContext('2d')

  if (!tempCtx) {
    return image
  }

  tempCtx.putImageData(image, 0, 0)
  ctx.drawImage(tempCanvas, dx, dy)

  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}

/**
 * Position an image for CPC auto mode
 *
 * Convenience wrapper around positionImage that extracts dimensions
 * from a CPC mode configuration object.
 *
 * @param image - Source ImageData to position
 * @param modeConfig - CPC mode configuration with width/height
 * @param palette - Color palette for background color
 * @param centerImage - Whether to center the image
 * @returns Positioned ImageData at mode dimensions
 */
export function positionImageForAutoMode(
  image: ImageData,
  modeConfig: { width: number; height: number },
  palette: Vector[],
  centerImage: boolean
): ImageData {
  return positionImage(
    image,
    { width: modeConfig.width, height: modeConfig.height },
    palette,
    { center: centerImage }
  )
}
