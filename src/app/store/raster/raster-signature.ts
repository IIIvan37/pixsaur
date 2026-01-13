/**
 * Raster Input Signature
 *
 * Tracks all inputs that affect raster generation.
 * Used to detect when rasters should be invalidated.
 */

import { atom } from 'jotai'
import {
  centerImageAtom,
  configAtom,
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  paletteStrategyAtom,
  resizeModeAtom
} from '../config/config'
import { imageAtom, selectionAtom } from '../image/image'

/**
 * Signature of all inputs that affect raster generation.
 * When any of these change, rasters should be cleared.
 *
 * Note: finalDithering is NOT included because it's applied AFTER raster optimization,
 * so changing it doesn't invalidate existing rasters.
 */
export const rasterInputSignatureAtom = atom((get) => {
  const image = get(imageAtom)
  const adjustments = get(configAtom)
  const strategy = get(paletteStrategyAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const hardware = get(cpcHardwareAtom)
  const selection = get(selectionAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)

  // Create a signature from all relevant inputs
  return {
    imageId: image ? image.src : null,
    adjustments: JSON.stringify(adjustments),
    strategy,
    modeConfig: JSON.stringify(modeConfig),
    hardware,
    selection: JSON.stringify(selection),
    resizeMode,
    centerImage
  }
})
