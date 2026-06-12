/**
 * Linear-light resize for the standard CPC pixel modes (0/1/2 + overscan).
 *
 * Replaces the gamma-space canvas `drawImage` path. Mode-agnostic: the
 * destination geometry comes entirely from `modeConfig` via the shared
 * `computeOriginContentRect` / `computeCoverCropRect` helpers. 'origin' never
 * scales vertically (dest height == source height) so it stays a pure
 * horizontal resample; 'cover' is a full 2D resample. ImageData-only (no
 * canvas) so it is unit-testable.
 */

import type { CpcModeConfig } from '@/domain/cpc'
import {
  computeCoverCropRect,
  computeOriginContentRect,
  type Selection
} from '@/source/image-resize'
import {
  type ResampleFilter,
  resampleHorizontalLinear,
  resampleLinear
} from './horizontal-resample'

/** Copy the top-left `width × height` region of `src` into a fresh ImageData. */
function cropTopLeft(src: ImageData, width: number, height: number): ImageData {
  if (width === src.width && height === src.height) return src
  const out = new ImageData(width, height)
  for (let y = 0; y < height; y++) {
    const srcStart = y * src.width * 4
    out.data.set(
      src.data.subarray(srcStart, srcStart + width * 4),
      y * width * 4
    )
  }
  return out
}

/** Copy an arbitrary (clamped, integer) region of `src` into a fresh ImageData. */
function cropRegion(
  src: ImageData,
  x: number,
  y: number,
  w: number,
  h: number
): ImageData {
  const ix = Math.max(0, Math.round(x))
  const iy = Math.max(0, Math.round(y))
  const iw = Math.min(src.width - ix, Math.round(w))
  const ih = Math.min(src.height - iy, Math.round(h))
  if (ix === 0 && iy === 0 && iw === src.width && ih === src.height) return src
  const out = new ImageData(iw, ih)
  for (let row = 0; row < ih; row++) {
    const srcStart = ((iy + row) * src.width + ix) * 4
    out.data.set(src.data.subarray(srcStart, srcStart + iw * 4), row * iw * 4)
  }
  return out
}

export function resampleOriginLinear(
  cropped: ImageData,
  modeConfig: CpcModeConfig,
  filter: ResampleFilter,
  centerImage = true
): ImageData {
  const selection: Selection = {
    sx: 0,
    sy: 0,
    width: cropped.width,
    height: cropped.height
  }
  const { sourceWidth, sourceHeight, destWidth, destHeight, dx, dy } =
    computeOriginContentRect(selection, modeConfig, centerImage)

  // Source region actually covered by the CPC canvas (excess is cropped out).
  const region = cropTopLeft(cropped, sourceWidth, sourceHeight)
  const resampled = resampleHorizontalLinear(region, destWidth, filter)

  // Opaque-black CPC-native canvas, content blitted at the centering offset.
  const out = new ImageData(modeConfig.width, modeConfig.height)
  for (let i = 0; i < out.data.length; i += 4) out.data[i + 3] = 255

  for (let y = 0; y < destHeight; y++) {
    const srcStart = y * destWidth * 4
    const destStart = ((y + dy) * out.width + dx) * 4
    out.data.set(
      resampled.data.subarray(srcStart, srcStart + destWidth * 4),
      destStart
    )
  }

  return out
}

/**
 * 'cover' linear downscale: crop the source to the CPC perceived aspect
 * (centered), then resample it to fill the full CPC canvas in linear light.
 */
export function resampleCoverLinear(
  cropped: ImageData,
  modeConfig: CpcModeConfig,
  filter: ResampleFilter
): ImageData {
  const selection: Selection = {
    sx: 0,
    sy: 0,
    width: cropped.width,
    height: cropped.height
  }
  const { srcX, srcY, srcW, srcH } = computeCoverCropRect(selection, modeConfig)
  const region = cropRegion(cropped, srcX, srcY, srcW, srcH)
  return resampleLinear(region, modeConfig.width, modeConfig.height, filter)
}
