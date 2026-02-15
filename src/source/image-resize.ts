/**
 * Image Resize Utilities for Pixsaur (moved from `src/utils`)
 */

import type { ResizeConfig } from '@/app/store/config/resize-types'

export interface Selection {
  sx: number
  sy: number
  width: number
  height: number
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
  const { width: cpcWidth, height: cpcHeight } = config.modeConfig
  const { scaleX, scaleY } = config.modeConfig
  const pixelRatio = scaleX / scaleY

  // Dimensions de sortie = dimensions CPC natives (pas d'affichage)
  const targetWidth = cpcWidth // 160 pour mode 0, 320 pour mode 1
  const targetHeight = cpcHeight // 200 pour tous les modes

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  // Calculer combien de pixels source on peut mapper sur le canvas CPC
  // Mode 0 : 1 pixel CPC = 2 pixels source (ratio 2:1)
  // Mode 1 : 1 pixel CPC = 1 pixel source (ratio 1:1)
  // Mode 2 : 1 pixel CPC = 0.5 pixel source (ratio 0.5:1, mais on prend 1:1 en pratique)

  // Pixels source couverts par le canvas CPC
  const sourceWidthCovered = targetWidth * pixelRatio // 160*2=320 pour mode 0
  const sourceHeightCovered = targetHeight // 200

  // Pixels source à lire (limités par la sélection)
  const sourceWidth = Math.min(selection.width, sourceWidthCovered)
  const sourceHeight = Math.min(selection.height, sourceHeightCovered)

  // Pixels CPC de destination
  const destWidth = Math.min(Math.floor(sourceWidth / pixelRatio), targetWidth)
  const destHeight = Math.min(sourceHeight, targetHeight)

  const dx = centerImage ? Math.floor((targetWidth - destWidth) / 2) : 0
  const dy = centerImage ? Math.floor((targetHeight - destHeight) / 2) : 0

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
  const { width: cpcWidth, height: cpcHeight } = config.modeConfig
  const { scaleX, scaleY } = config.modeConfig
  const pixelRatio = scaleX / scaleY

  // Target dimensions in CPC native pixels
  const targetWidth = cpcWidth
  const targetHeight = cpcHeight

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Calculate PERCEIVED aspect ratios
  // Source image has square pixels
  const sourceAspect = selection.width / selection.height
  // CPC target has non-square pixels in mode 0 (2:1) and mode 2 (0.5:1)
  // The perceived aspect ratio = (targetWidth * pixelRatio) / targetHeight
  const targetPerceivedAspect = (targetWidth * pixelRatio) / targetHeight

  let srcX = selection.sx
  let srcY = selection.sy
  let srcW = selection.width
  let srcH = selection.height

  // Cover mode: scale to fill, crop excess to match perceived aspect ratio
  if (sourceAspect > targetPerceivedAspect) {
    // Source is wider than target (perceived): crop horizontally
    // Keep full height, calculate width to match target aspect ratio
    const newWidth = selection.height * targetPerceivedAspect
    srcX = selection.sx + (selection.width - newWidth) / 2
    srcW = newWidth
  } else if (sourceAspect < targetPerceivedAspect) {
    // Source is taller than target (perceived): crop vertically
    // Keep full width, calculate height to match target aspect ratio
    const newHeight = selection.width / targetPerceivedAspect
    srcY = selection.sy + (selection.height - newHeight) / 2
    srcH = newHeight
  }
  // If equal, no cropping needed

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
