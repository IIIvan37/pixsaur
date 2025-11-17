/**
 * Image Resize Utilities for Pixsaur (moved from `src/utils`)
 */

import type { ResizeConfig } from '@/app/store/config/resize-types'
import { getNormalizedTargetSize } from '@/app/store/config/resize-types'

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
  const { width: targetWidth, height: targetHeight } = getNormalizedTargetSize(
    config.modeConfig
  )

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  const drawWidth = Math.min(selection.width, targetWidth)
  const drawHeight = Math.min(selection.height, targetHeight)

  const dx = centerImage ? Math.floor((targetWidth - drawWidth) / 2) : 0
  const dy = centerImage ? Math.floor((targetHeight - drawHeight) / 2) : 0

  ctx.drawImage(
    sourceCanvas,
    selection.sx,
    selection.sy,
    drawWidth,
    drawHeight,
    dx,
    dy,
    drawWidth,
    drawHeight
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
