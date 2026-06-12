/**
 * Image Pipeline Atoms
 *
 * Single responsibility: Image transformation pipeline (crop → resize → smooth)
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import {
  applyResize,
  getVisualRegion,
  resampleCoverLinear,
  resampleOriginLinear,
  type Selection
} from '@/preview'
import { smoothImage } from '@/preview/application/smooth-image'
import {
  autoDistinctMappingAtom,
  centerImageAtom,
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  horizontalSmoothingAtom,
  pixelModeAtom,
  resampleStrategyAtom,
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
  const resampleStrategy = get(resampleStrategyAtom)
  const cropped = await get(croppedImageAtom)

  if (!cropped) {
    return cropped
  }

  // Linear-light downscale (filter + decimate) instead of the gamma-space
  // canvas drawImage path, for every pixel mode. 'classic' keeps the legacy
  // canvas path below. 'auto' is handled later in normalizedImageAtom.
  const useLinear = resampleStrategy !== 'classic'
  if (useLinear && resizeMode === 'origin') {
    return resampleOriginLinear(
      cropped,
      modeConfig,
      resampleStrategy,
      centerImage
    )
  }
  if (useLinear && resizeMode === 'cover') {
    return resampleCoverLinear(cropped, modeConfig, resampleStrategy)
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
 * Apply horizontal smoothing after resize.
 *
 * Thin adapter over the `smoothImage` use-case
 * (`@/preview/application/smooth-image`): assembles the input from atoms and
 * delegates the pure transformation (smoothing is disabled when distinct-mapping
 * is active — CPC Classic + Mode 0). Stays async only to await its upstream
 * pipeline atom.
 */
export const smoothedImageAtom = atom(async (get) =>
  smoothImage({
    resized: await get(resizedImageAtom),
    horizontalSmoothing: get(horizontalSmoothingAtom),
    pixelMode: get(pixelModeAtom),
    autoDistinctMapping: get(autoDistinctMappingAtom),
    cpcHardware: get(cpcHardwareAtom),
    modeConfig: get(effectiveModeConfigAtom),
    resizeMode: get(resizeModeAtom),
    resampleStrategy: get(resampleStrategyAtom)
  })
)
