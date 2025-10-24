/**
 * Image Resize Utilities for Pixsaur
 * Dimensions are calculated automatically from CPC mode
 */

import type { ResizeConfig } from '@/app/store/config/resize-types'
import { getDefaultTargetSize } from '@/app/store/config/resize-types'

export interface Selection {
  sx: number
  sy: number
  width: number
  height: number
}

/**
 * Apply resize transformation to selected region
 * @param sourceCanvas Original image canvas
 * @param selection Region to extract
 * @param config Resize configuration
 * @returns New canvas with resized image
 */
export function applyResize(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig
): HTMLCanvasElement {
  const mode = config.mode

  switch (mode) {
    case 'auto':
      return resizeAuto(sourceCanvas, selection)
    case 'origin':
      return resizeOrigin(sourceCanvas, selection, config)
  }
}

/**
 * Mode AUTO: Smart resize with CPC aspect ratio correction (RECOMMENDED)
 * Returns the selection as-is, because the smart resize (getVisualRegion)
 * already applied CPC pixel aspect ratio correction before this step.
 * This is the default behavior when no specific transformation is needed.
 */
function resizeAuto(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection
): HTMLCanvasElement {
  // Simply extract the selection without any transformation
  // The smart resize already happened in getVisualRegion
  return extractSelection(sourceCanvas, selection)
}

/**
 * Mode ORIGIN: Keep original selection size
 * No scaling applied. If selection is larger than target, it's cropped (top-left).
 * If smaller, it's centered with black borders.
 */
function resizeOrigin(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig
): HTMLCanvasElement {
  // Calculate target dimensions from CPC mode
  const { width: targetWidth, height: targetHeight } = getDefaultTargetSize(config.cpcMode)
  
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Fill with black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  // Calculate positioning
  const sourceWidth = Math.min(selection.width, targetWidth)
  const sourceHeight = Math.min(selection.height, targetHeight)

  const offsetX = Math.max(0, (targetWidth - selection.width) / 2)
  const offsetY = Math.max(0, (targetHeight - selection.height) / 2)

  // Center source crop if image is larger than target
  const sourceOffsetX =
    selection.width > targetWidth
      ? selection.sx + (selection.width - targetWidth) / 2
      : selection.sx
  const sourceOffsetY =
    selection.height > targetHeight
      ? selection.sy + (selection.height - targetHeight) / 2
      : selection.sy

  ctx.drawImage(
    sourceCanvas,
    sourceOffsetX,
    sourceOffsetY,
    sourceWidth,
    sourceHeight,
    offsetX,
    offsetY,
    sourceWidth,
    sourceHeight
  )

  return outputCanvas
}

/**
 * Extract selection region without resizing (utility function)
 */
export function extractSelection(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection
): HTMLCanvasElement {
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = selection.width
  outputCanvas.height = selection.height

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  ctx.drawImage(
    sourceCanvas,
    selection.sx,
    selection.sy,
    selection.width,
    selection.height,
    0,
    0,
    selection.width,
    selection.height
  )

  return outputCanvas
}
