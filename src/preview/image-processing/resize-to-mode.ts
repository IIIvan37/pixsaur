/**
 * Resize a cropped image to a target CPC mode's canvas.
 *
 * The one resize step of the preview pipeline, parameterized by the target
 * `CpcModeConfig` so every rendering path shares it: the standard pipeline
 * passes the effective mode config, EGX passes its high-resolution one. Before
 * this existed, `resizedImageAtom` and `egxNormalizedImageAtom` each rolled
 * their own canvas round-trip — and only the standard one reached the
 * linear-light resamplers.
 *
 * `auto` is deliberately a no-op here (beyond the canvas round-trip
 * `applyResize` performs): auto-mode scaling happens later, in the
 * `normalizeImage` use-case, which needs the smoothed image.
 */

import { logger } from '@/core'
import type { CpcModeConfig } from '@/domain/cpc'
import type { ResampleStrategy, ResizeMode } from '@/domain/image-processing'
import { applyResize, type Selection } from './image-resize'
import { resampleCoverLinear, resampleOriginLinear } from './resize-resample'

export interface ResizeToModeOptions {
  /** Target CPC mode config — dimensions and pixel ratio of the output. */
  modeConfig: CpcModeConfig
  /** Active resize mode. */
  resizeMode: ResizeMode
  centerImage: boolean
  /** Resampling strategy; `classic` keeps the legacy gamma-space canvas path. */
  resampleStrategy: ResampleStrategy
}

/**
 * Resizes `cropped` to `options.modeConfig`'s canvas.
 *
 * `origin`/`cover` use the linear-light resamplers (filter + decimate) unless
 * the `classic` strategy is selected, in which case — like `auto` — the legacy
 * `applyResize` canvas path runs. Returns `cropped` untouched if a canvas
 * context cannot be obtained or the resize throws.
 */
export function resizeToMode(
  cropped: ImageData,
  options: ResizeToModeOptions
): ImageData {
  const { modeConfig, resizeMode, centerImage, resampleStrategy } = options

  // Linear-light downscale (filter + decimate) instead of the gamma-space
  // canvas drawImage path, for every pixel mode. 'classic' keeps the legacy
  // canvas path below. 'auto' is handled later, in `normalizeImage`.
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

  const canvas = document.createElement('canvas')
  canvas.width = cropped.width
  canvas.height = cropped.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return cropped

  ctx.putImageData(cropped, 0, 0)

  // Source = the entire cropped canvas.
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
      { mode: resizeMode, modeConfig },
      centerImage
    )

    const resizedCtx = resizedCanvas.getContext('2d')
    if (!resizedCtx) return cropped

    return resizedCtx.getImageData(
      0,
      0,
      resizedCanvas.width,
      resizedCanvas.height
    )
  } catch (error) {
    logger.error('Resize failed:', error)
    return cropped
  }
}
