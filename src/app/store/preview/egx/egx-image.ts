/**
 * EGX Image Processing
 *
 * Normalizes the image to EGX dimensions (EGX1: 320×200, EGX2: 640×200, or the
 * overscan equivalents) by driving the *standard* pipeline steps with the EGX
 * mode config instead of forking them: the shared `croppedImageAtom`, the
 * shared `resizeToMode` helper, and the `normalizeImage` /
 * `positionNormalizedImage` use-cases. Only the smoothing step stays EGX-local,
 * because it keys on the EGX high-resolution mode's pixel width.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import {
  applyHorizontalSmoothing,
  getPixelWidthForMode,
  resizeToMode
} from '@/preview'
import {
  normalizeImage,
  positionNormalizedImage
} from '@/preview/application/normalize-image'
import {
  centerImageAtom,
  egxEnabledAtom,
  horizontalSmoothingAtom,
  resampleStrategyAtom,
  resizeModeAtom
} from '../../config/config'
import { croppedImageAtom, exportPaletteWithSlotsAtom } from '../preview'
import { egxModeConfigAtom } from './egx-config'

/**
 * Image resized and normalized to EGX dimensions (high-resolution mode).
 * Starts from the shared cropped image rather than the standard pipeline's
 * resized one, which sits at the *base* mode's dimensions.
 */
export const egxNormalizedImageAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const egxModeConfig = get(egxModeConfigAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)
  const resampleStrategy = get(resampleStrategyAtom)
  const horizontalSmoothing = get(horizontalSmoothingAtom)
  const cropped = await get(croppedImageAtom)
  const exportPalette = await get(exportPaletteWithSlotsAtom)

  if (!egxModeConfig || !cropped) return null

  const resized = resizeToMode(cropped, {
    modeConfig: egxModeConfig,
    resizeMode,
    centerImage,
    resampleStrategy
  })

  let normalized = positionNormalizedImage({
    normalized: normalizeImage({
      processed: resized,
      modeConfig: egxModeConfig,
      resizeMode,
      resampleStrategy
    }),
    modeConfig: egxModeConfig,
    resizeMode,
    exportPalette,
    centerImage
  })

  if (!normalized) {
    logger.warn('[EGX] Failed to normalize image')
    return null
  }

  if (horizontalSmoothing) {
    const pixelWidth = getPixelWidthForMode(egxModeConfig.mode)
    normalized = applyHorizontalSmoothing(normalized, pixelWidth)
  }

  logger.info('[EGX] Normalized image', {
    width: normalized.width,
    height: normalized.height,
    targetWidth: egxModeConfig.width,
    targetHeight: egxModeConfig.height
  })

  return normalized
})
