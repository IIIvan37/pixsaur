/**
 * CPC mode 0 horizontal 2:1 downscale in linear light.
 *
 * Replaces the gamma-space canvas `drawImage` path for mode 0 'origin' resize:
 * reads the covered source region, resamples it horizontally to the CPC-native
 * width with the chosen filter, then places it (centered, black padding) into a
 * mode-0-sized canvas. Vertical rows are never scaled — in origin mode the
 * destination height always equals the source height, so this stays a pure
 * horizontal resample. ImageData-only (no canvas) so it is unit-testable.
 */

import type { CpcModeConfig } from '@/app/store/config/types'
import { computeOriginContentRect, type Selection } from '@/source/image-resize'
import {
  type ResampleFilter,
  resampleHorizontalLinear
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

export function resampleMode0Origin(
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

  // Opaque-black mode-0 canvas, content blitted at the centering offset.
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
