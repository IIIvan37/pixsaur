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
 * No scaling applied. Always starts from top-left (0,0) - no centering, no padding.
 * If selection is larger than target, it's cropped from top-left.
 * If smaller, only the image area is drawn (no black borders added).
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

  // Calculate how much of the source we can draw (crop if needed)
  const drawWidth = Math.min(selection.width, targetWidth)
  const drawHeight = Math.min(selection.height, targetHeight)

  // Always draw from top-left (0, 0) - no centering
  ctx.drawImage(
    sourceCanvas,
    selection.sx,           // Source start X
    selection.sy,           // Source start Y
    drawWidth,              // Source width (cropped if too large)
    drawHeight,             // Source height (cropped if too large)
    0,                      // Destination X: always top-left
    0,                      // Destination Y: always top-left
    drawWidth,              // Destination width (1:1, no scaling)
    drawHeight              // Destination height (1:1, no scaling)
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
