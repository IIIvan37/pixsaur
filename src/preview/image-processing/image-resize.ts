/**
 * Image Resize Utilities for Pixsaur (moved from `src/utils`)
 */

import type { ResizeConfig } from '@/domain/image-processing'

export interface Selection {
  sx: number
  sy: number
  width: number
  height: number
}

/** Placement of the source content inside the CPC-native canvas (origin mode). */
export interface OriginContentRect {
  /** Source pixels read from the selection. */
  sourceWidth: number
  sourceHeight: number
  /** Content size once mapped to CPC native pixels. */
  destWidth: number
  destHeight: number
  /** Top-left offset of the content inside the CPC canvas (centering padding). */
  dx: number
  dy: number
}

/**
 * Compute how a selection maps onto the CPC-native canvas in 'origin' mode:
 * the source region read, the destination content size (after the mode's
 * horizontal pixel-ratio compression), and the centering offsets. Shared by
 * `resizeOrigin` and the mode-0 linear resampler so both stay in sync.
 */
export function computeOriginContentRect(
  selection: Selection,
  modeConfig: ResizeConfig['modeConfig'],
  centerImage = true
): OriginContentRect {
  const {
    width: targetWidth,
    height: targetHeight,
    scaleX,
    scaleY
  } = modeConfig
  const pixelRatio = scaleX / scaleY

  const sourceWidth = Math.min(selection.width, targetWidth * pixelRatio)
  const sourceHeight = Math.min(selection.height, targetHeight)

  const destWidth = Math.min(Math.floor(sourceWidth / pixelRatio), targetWidth)
  const destHeight = Math.min(sourceHeight, targetHeight)

  const dx = centerImage ? Math.floor((targetWidth - destWidth) / 2) : 0
  const dy = centerImage ? Math.floor((targetHeight - destHeight) / 2) : 0

  return { sourceWidth, sourceHeight, destWidth, destHeight, dx, dy }
}

/** Source crop rectangle for 'cover' resize (scale-to-fill, centered crop). */
export interface CoverCropRect {
  srcX: number
  srcY: number
  srcW: number
  srcH: number
}

/**
 * Compute the centered source crop that matches the CPC perceived aspect ratio
 * in 'cover' mode (excess cropped on the longer axis). Shared by `resizeCover`
 * and the mode-0 linear resampler.
 */
export function computeCoverCropRect(
  selection: Selection,
  modeConfig: ResizeConfig['modeConfig']
): CoverCropRect {
  const {
    width: targetWidth,
    height: targetHeight,
    scaleX,
    scaleY
  } = modeConfig
  const pixelRatio = scaleX / scaleY
  const sourceAspect = selection.width / selection.height
  const targetPerceivedAspect = (targetWidth * pixelRatio) / targetHeight

  let srcX = selection.sx
  let srcY = selection.sy
  let srcW = selection.width
  let srcH = selection.height

  if (sourceAspect > targetPerceivedAspect) {
    const newWidth = selection.height * targetPerceivedAspect
    srcX = selection.sx + (selection.width - newWidth) / 2
    srcW = newWidth
  } else if (sourceAspect < targetPerceivedAspect) {
    const newHeight = selection.width / targetPerceivedAspect
    srcY = selection.sy + (selection.height - newHeight) / 2
    srcH = newHeight
  }

  return { srcX, srcY, srcW, srcH }
}

export function applyResize(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig,
  centerImage = true
): HTMLCanvasElement {
  const mode = config.mode

  switch (mode) {
    case 'auto':
      return resizeAuto(sourceCanvas, selection)
    case 'origin':
      return resizeOrigin(sourceCanvas, selection, config, centerImage)
    case 'cover':
      return resizeCover(sourceCanvas, selection, config)
  }
}

function resizeAuto(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection
): HTMLCanvasElement {
  return extractSelection(sourceCanvas, selection)
}

function resizeOrigin(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig,
  centerImage = true
): HTMLCanvasElement {
  // Pour mode origin, on travaille avec les dimensions CPC natives (pas l'affichage)
  // Mode 0 : 160×200 (pixels CPC, seront étirés par le pipeline de preview)
  // Mode 1 : 320×200 (pixels carrés)
  // Mode 2 : 640×200 (mais limité par la sélection)
  const { width: targetWidth, height: targetHeight } = config.modeConfig

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  // Mapping source -> CPC natif (compression horizontale selon le pixel-ratio du mode)
  const { sourceWidth, sourceHeight, destWidth, destHeight, dx, dy } =
    computeOriginContentRect(selection, config.modeConfig, centerImage)

  // Compression directe de la source vers les dimensions CPC
  // Mode 0 : 320×200 source → 160×200 CPC (compression horizontale)
  // Mode 1 : 320×200 source → 320×200 CPC (1:1)
  // Mode 2 : 320×200 source → 320×200 CPC (ou moins si selection plus petite)
  ctx.imageSmoothingEnabled = true // Lissage pour la compression
  ctx.drawImage(
    sourceCanvas,
    selection.sx,
    selection.sy,
    sourceWidth,
    sourceHeight,
    dx,
    dy,
    destWidth,
    destHeight
  )

  return outputCanvas
}

/**
 * Resize mode "cover": Scale the image to fill the target dimensions completely,
 * cropping any excess. The image is centered, so cropping is symmetric.
 *
 * Similar to CSS background-size: cover or object-fit: cover.
 * Takes into account CPC pixel aspect ratio to preserve perceived proportions.
 *
 * @param sourceCanvas - Source canvas with the image
 * @param selection - Selection rectangle within the source
 * @param config - Resize configuration with target dimensions
 * @returns Canvas filled with the scaled and cropped image
 */
function resizeCover(
  sourceCanvas: HTMLCanvasElement,
  selection: Selection,
  config: ResizeConfig
): HTMLCanvasElement {
  // Target dimensions in CPC native pixels
  const { width: targetWidth, height: targetHeight } = config.modeConfig

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Cover mode: scale to fill, crop excess to match perceived aspect ratio.
  const { srcX, srcY, srcW, srcH } = computeCoverCropRect(
    selection,
    config.modeConfig
  )

  ctx.imageSmoothingEnabled = true
  ctx.drawImage(
    sourceCanvas,
    srcX,
    srcY,
    srcW,
    srcH,
    0,
    0,
    targetWidth,
    targetHeight
  )

  return outputCanvas
}

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
