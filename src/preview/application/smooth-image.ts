/**
 * `smoothImage` use-case — pure horizontal smoothing for the preview pipeline
 * (clean-archi strangler-fig).
 *
 * Replaces the inlined orchestration of `smoothedImageAtom` in
 * `src/app/store/preview/pipeline/image-pipeline.ts`.
 *
 * No port (like `normalizeImage` / `buildIndexBuffer`): a pure, synchronous
 * transformation. The helpers it calls (`getPixelWidthForMode`,
 * `applyHorizontalSmoothing`) are deterministic image-processing functions
 * invoked directly. The atom stays async only because it awaits its upstream
 * pipeline atom.
 *
 * Returns `ImageData | null` directly (no `Result` union): the `null` case (no
 * upstream image yet) is a pipeline-availability concern, not an expected
 * error.
 *
 * Living registry: see `./README.md`.
 */

import type { ResizeMode } from '@/app/store/config/resize-types'
import type { CpcModeConfig, ResampleStrategy } from '@/app/store/config/types'
import type { CPCHardware } from '@/libs/types'
import {
  applyHorizontalSmoothing,
  getPixelWidthForMode
} from '../image-processing/horizontal-smoothing'

export interface SmoothImageInput {
  /** Resized source image; `null` while the pipeline has no image yet. */
  resized: ImageData | null
  /** User toggle for horizontal smoothing. */
  horizontalSmoothing: boolean
  /** Active pixel mode — selects the smoothing window width. */
  pixelMode: number
  /** Auto distinct-mapping toggle (CPC Classic + Mode 0). */
  autoDistinctMapping: boolean
  /** Selected CPC hardware. */
  cpcHardware: CPCHardware
  /** Effective CPC mode config — only `nColors` is consumed. */
  modeConfig: CpcModeConfig
  /** Active resize mode — `origin`/`cover` may skip a second blur. */
  resizeMode: ResizeMode
  /** Resampling strategy; non-`classic` already anti-aliased the resize. */
  resampleStrategy: ResampleStrategy
}

/**
 * Applies horizontal smoothing to the resized image.
 *
 * Smoothing is skipped when the linear resampler already ran (non-`classic`
 * strategy in `origin`/`cover` — it IS the anti-alias filter, so a second
 * gamma-space box blur would undo the gain), when distinct-mapping is active
 * (CPC Classic + Mode 0, i.e. `nColors === 16`), when the user toggle is off,
 * or when the mode's pixel width is 1 (nothing to average). In every skip case
 * the resized image is returned untouched.
 */
export function smoothImage(input: SmoothImageInput): ImageData | null {
  const {
    resized,
    horizontalSmoothing,
    pixelMode,
    autoDistinctMapping,
    cpcHardware,
    modeConfig,
    resizeMode,
    resampleStrategy
  } = input

  if (!resized) return null

  // When the linear resampler ran ('origin'/'cover', non-classic), it IS the
  // anti-alias filter — a second gamma-space box blur would undo the gain.
  const useLinear = resampleStrategy !== 'classic'
  if (useLinear && (resizeMode === 'origin' || resizeMode === 'cover')) {
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
}
