/**
 * EGX Image Processing
 *
 * Handles image normalization for EGX dimensions.
 * EGX1: 320×200, EGX2: 640×200 (or overscan equivalents)
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import {
  applyHorizontalSmoothing,
  getPixelWidthForMode,
  getVisualRegionNormalized
} from '@/preview'
import { applyResize, type Selection } from '@/source'
import {
  centerImageAtom,
  egxEnabledAtom,
  horizontalSmoothingAtom,
  resizeModeAtom
} from '../../config/config'
import { selectionAtom, workingImageAtom } from '../../image/image'
import {
  exportPaletteWithSlotsAtom,
  positionImageForAutoMode
} from '../preview'
import { egxModeConfigAtom } from './egx-config'

/**
 * Image resized and normalized to EGX dimensions (high-resolution mode).
 * Uses the source image (not the standard pipeline's resized image)
 * to ensure correct dimensions:
 * - EGX1: 320×200 (or overscan equivalent)
 * - EGX2: 640×200 (or overscan equivalent)
 */
export const egxNormalizedImageAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const egxModeConfig = get(egxModeConfigAtom)
  const workingImage = await get(workingImageAtom)
  const selection = get(selectionAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)
  const horizontalSmoothing = get(horizontalSmoothingAtom)
  const palette = await get(exportPaletteWithSlotsAtom)

  if (!egxModeConfig || !workingImage || !selection) return null

  // 1. Crop the selection from the working image
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = selection.width
  cropCanvas.height = selection.height
  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) return null

  // Put the working image on a temp canvas to extract the selection
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = workingImage.width
  tempCanvas.height = workingImage.height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return null
  tempCtx.putImageData(workingImage, 0, 0)

  // Extract the selection
  cropCtx.drawImage(
    tempCanvas,
    selection.sx,
    selection.sy,
    selection.width,
    selection.height,
    0,
    0,
    selection.width,
    selection.height
  )

  // 2. Resize based on mode
  let resizedImageData: ImageData

  if (resizeMode === 'origin') {
    // Mode origin: use applyResize which handles the pixel ratio
    const relativeSelection: Selection = {
      sx: 0,
      sy: 0,
      width: selection.width,
      height: selection.height
    }

    let resizedCanvas: HTMLCanvasElement
    try {
      resizedCanvas = applyResize(
        cropCanvas,
        relativeSelection,
        {
          mode: resizeMode,
          modeConfig: egxModeConfig
        },
        centerImage
      )
    } catch {
      logger.warn('[EGX] Failed to resize image')
      return null
    }

    const resizedCtx = resizedCanvas.getContext('2d')
    if (!resizedCtx) return null
    resizedImageData = resizedCtx.getImageData(
      0,
      0,
      resizedCanvas.width,
      resizedCanvas.height
    )
  } else {
    // Mode auto: normalize to EGX dimensions using getVisualRegionNormalized
    const croppedImageData = cropCtx.getImageData(
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    )
    const normalized = getVisualRegionNormalized(
      croppedImageData,
      egxModeConfig
    )
    if (!normalized) {
      logger.warn('[EGX] Failed to normalize image')
      return null
    }

    // Position in target dimensions (adds margins with darkest color)
    resizedImageData = positionImageForAutoMode(
      normalized,
      egxModeConfig,
      palette,
      centerImage
    )
  }

  // 3. Apply horizontal smoothing if enabled
  if (horizontalSmoothing) {
    const pixelWidth = getPixelWidthForMode(egxModeConfig.mode)
    resizedImageData = applyHorizontalSmoothing(resizedImageData, pixelWidth)
  }

  logger.info('[EGX] Normalized image', {
    width: resizedImageData.width,
    height: resizedImageData.height,
    targetWidth: egxModeConfig.width,
    targetHeight: egxModeConfig.height
  })

  return resizedImageData
})
