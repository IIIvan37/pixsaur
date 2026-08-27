/**
 * Image Pipeline Atoms
 *
 * Single responsibility: Image transformation pipeline (crop → resize → smooth)
 */

import { atom } from 'jotai'
import { getVisualRegion, resizeToMode } from '@/preview'
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
 * Apply resize transformation to the effective CPC mode's canvas.
 *
 * Thin adapter over the shared `resizeToMode` helper (`@/preview`), which the
 * EGX path drives with its own high-resolution mode config.
 */
export const resizedImageAtom = atom(async (get) => {
  // Read all atoms synchronously (before any await) so Jotai tracks them.
  const options = {
    modeConfig: get(effectiveModeConfigAtom),
    resizeMode: get(resizeModeAtom),
    centerImage: get(centerImageAtom),
    resampleStrategy: get(resampleStrategyAtom)
  }
  const cropped = await get(croppedImageAtom)

  return cropped ? resizeToMode(cropped, options) : cropped
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
