/**
 * Image Pipeline Atoms
 *
 * Single responsibility: Image transformation pipeline (crop → resize → smooth)
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import {
  applyHorizontalSmoothing,
  getPixelWidthForMode,
  getVisualRegion,
  resampleMode0Cover,
  resampleMode0Origin
} from '@/preview'
import { applyResize, type Selection } from '@/source'
import {
  autoDistinctMappingAtom,
  centerImageAtom,
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  horizontalSmoothingAtom,
  mode0FilterAtom,
  pixelModeAtom,
  resizeModeAtom
} from '../../config/config'
import { selectionAtom, workingImageAtom } from '../../image/image'

// ============================================================================
// 1. CROPPED IMAGE
// ============================================================================

/**
 * Extract selected region from source image
 */
export const croppedImageAtom = atom(async (get) => {
  const workingImageData = await get(workingImageAtom)
  const selection = get(selectionAtom)

  if (!workingImageData || !selection) {
    return null
  }

  return getVisualRegion(workingImageData, selection)
})

// ============================================================================
// 2. RESIZED IMAGE
// ============================================================================

/**
 * Apply resize transformation based on selected mode
 * - 'auto': Smart resize with CPC aspect ratio correction
 * - 'origin': Keep original dimensions
 */
export const resizedImageAtom = atom(async (get) => {
  // Read all atoms synchronously (before any await) so Jotai tracks them.
  const resizeMode = get(resizeModeAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const centerImage = get(centerImageAtom)
  const mode0Filter = get(mode0FilterAtom)
  const cropped = await get(croppedImageAtom)

  if (!cropped) {
    return cropped
  }

  // Mode 0: linear-light downscale (filter + decimate) instead of the
  // gamma-space canvas drawImage path. 'auto' is handled later in
  // normalizedImageAtom; 'origin' and 'cover' are handled here.
  const isMode0 = modeConfig.mode === 0 && modeConfig.nColors === 16
  if (isMode0 && resizeMode === 'origin') {
    return resampleMode0Origin(cropped, modeConfig, mode0Filter, centerImage)
  }
  if (isMode0 && resizeMode === 'cover') {
    return resampleMode0Cover(cropped, modeConfig, mode0Filter)
  }

  // Convert ImageData to Canvas for applyResize
  const canvas = document.createElement('canvas')
  canvas.width = cropped.width
  canvas.height = cropped.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return cropped

  ctx.putImageData(cropped, 0, 0)

  // Prepare relative selection (source = entire cropped canvas)
  const relativeSelection: Selection = {
    sx: 0,
    sy: 0,
    width: cropped.width,
    height: cropped.height
  }

  try {
    const resizedCanvas = applyResize(
      canvas,
      relativeSelection,
      {
        mode: resizeMode,
        modeConfig
      },
      centerImage
    )

    const resizedCtx = resizedCanvas.getContext('2d')
    if (!resizedCtx) {
      return cropped
    }

    return resizedCtx.getImageData(
      0,
      0,
      resizedCanvas.width,
      resizedCanvas.height
    )
  } catch (error) {
    logger.error('Resize failed:', error)
    return cropped // Fallback to cropped image
  }
})

// ============================================================================
// 3. SMOOTHED IMAGE
// ============================================================================

/**
 * Apply horizontal smoothing after resize
 * Disabled when distinct-mapping is active (CPC Classic + Mode 0)
 */
export const smoothedImageAtom = atom(async (get) => {
  const horizontalSmoothing = get(horizontalSmoothingAtom)
  const pixelMode = get(pixelModeAtom)
  const autoDistinctMapping = get(autoDistinctMappingAtom)
  const cpcHardware = get(cpcHardwareAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const resizeMode = get(resizeModeAtom)
  const resized = await get(resizedImageAtom)

  if (!resized) {
    return null
  }

  // Mode 0 'origin'/'cover' already ran the linear-light resampler (which IS
  // the anti-alias filter). A second gamma-space box blur would undo the gain.
  const isMode0 = modeConfig.mode === 0 && modeConfig.nColors === 16
  if (isMode0 && (resizeMode === 'origin' || resizeMode === 'cover')) {
    return resized
  }

  // Disable smoothing when distinct-mapping is active (CPC Classic + Mode 0)
  const isDistinctMappingActive =
    autoDistinctMapping &&
    cpcHardware === 'classic' &&
    modeConfig.nColors === 16

  if (horizontalSmoothing && !isDistinctMappingActive) {
    const pixelWidth = getPixelWidthForMode(pixelMode)
    if (pixelWidth > 1) {
      return applyHorizontalSmoothing(resized, pixelWidth)
    }
  }

  return resized
})
