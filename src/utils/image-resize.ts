/**
 * Image Resize Utilities for Pixsaur
 * Implements 5 resize modes from ConvImgCpc system
 */

import type { ResizeConfig } from '@/app/store/config/resize-types'

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
    case 'fit':
      return resizeFit(sourceCanvas, selection, config)
    case 'keepSmaller':
      return resizeKeepSmaller(sourceCanvas, selection, config)
    case 'keepLarger':
      return resizeKeepLarger(sourceCanvas, selection, config)
    case 'userSize':
      return resizeUserSize(sourceCanvas, selection, config)
    case 'origin':
      return resizeOrigin(sourceCanvas, selection, config)
  }
}

/**
 * Mode 1: FIT - Stretch selection to fill target dimensions
 * Simply scales the selection to target size (may distort aspect ratio)
 */
function resizeFit(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig
): HTMLCanvasElement {
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = config.targetWidth
  outputCanvas.height = config.targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Direct stretch from selection to target
  ctx.drawImage(
    sourceCanvas,
    selection.sx,
    selection.sy,
    selection.width,
    selection.height,
    0,
    0,
    config.targetWidth,
    config.targetHeight
  )

  return outputCanvas
}

/**
 * Mode 2: KEEP SMALLER - Fit inside target (letterbox/pillarbox)
 * Scales to fit within target, preserving aspect ratio.
 * Centers the image and fills borders with black.
 */
function resizeKeepSmaller(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig
): HTMLCanvasElement {
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = config.targetWidth
  outputCanvas.height = config.targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Fill with black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, config.targetWidth, config.targetHeight)

  // Calculate scale to fit inside target
  const scaleX = config.targetWidth / selection.width
  const scaleY = config.targetHeight / selection.height
  const scale = Math.min(scaleX, scaleY)

  const scaledWidth = selection.width * scale
  const scaledHeight = selection.height * scale

  // Center the scaled image
  const offsetX = (config.targetWidth - scaledWidth) / 2
  const offsetY = (config.targetHeight - scaledHeight) / 2

  ctx.drawImage(
    sourceCanvas,
    selection.sx,
    selection.sy,
    selection.width,
    selection.height,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight
  )

  return outputCanvas
}

/**
 * Mode 3: KEEP LARGER - Fill target (crop excess)
 * Scales to fill target completely, preserving aspect ratio.
 * Crops excess content (centered).
 */
function resizeKeepLarger(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig
): HTMLCanvasElement {
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = config.targetWidth
  outputCanvas.height = config.targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Calculate scale to fill target
  const scaleX = config.targetWidth / selection.width
  const scaleY = config.targetHeight / selection.height
  const scale = Math.max(scaleX, scaleY)

  const scaledWidth = selection.width * scale
  const scaledHeight = selection.height * scale

  // Center and crop
  const offsetX = (config.targetWidth - scaledWidth) / 2
  const offsetY = (config.targetHeight - scaledHeight) / 2

  ctx.drawImage(
    sourceCanvas,
    selection.sx,
    selection.sy,
    selection.width,
    selection.height,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight
  )

  return outputCanvas
}

/**
 * Mode 4: USER SIZE - Custom position and size
 * Advanced mode: user specifies both output size and source position/size.
 * Falls back to fit mode if custom parameters not provided.
 */
function resizeUserSize(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig
): HTMLCanvasElement {
  // If no custom parameters, use fit mode as fallback
  if (!config.customPosition || !config.customSize) {
    return resizeFit(sourceCanvas, selection, config)
  }

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = config.targetWidth
  outputCanvas.height = config.targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Fill with black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, config.targetWidth, config.targetHeight)

  // Use custom parameters
  const { x: customX, y: customY } = config.customPosition
  const { width: customWidth, height: customHeight } = config.customSize

  ctx.drawImage(
    sourceCanvas,
    selection.sx,
    selection.sy,
    selection.width,
    selection.height,
    customX,
    customY,
    customWidth,
    customHeight
  )

  return outputCanvas
}

/**
 * Mode 5: ORIGIN - Keep original selection size
 * No scaling applied. If selection is larger than target, it's cropped (centered).
 * If smaller, it's centered with black borders.
 */
function resizeOrigin(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig
): HTMLCanvasElement {
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = config.targetWidth
  outputCanvas.height = config.targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Fill with black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, config.targetWidth, config.targetHeight)

  // Calculate positioning
  const sourceWidth = Math.min(selection.width, config.targetWidth)
  const sourceHeight = Math.min(selection.height, config.targetHeight)

  const offsetX = Math.max(0, (config.targetWidth - selection.width) / 2)
  const offsetY = Math.max(0, (config.targetHeight - selection.height) / 2)

  // Center source crop if image is larger than target
  const sourceOffsetX =
    selection.width > config.targetWidth
      ? selection.sx + (selection.width - config.targetWidth) / 2
      : selection.sx
  const sourceOffsetY =
    selection.height > config.targetHeight
      ? selection.sy + (selection.height - config.targetHeight) / 2
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
