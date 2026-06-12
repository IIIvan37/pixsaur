/**
 * `normalizeImage` / `positionNormalizedImage` use-cases — pure resize &
 * positioning for the preview pipeline (clean-archi strangler-fig).
 *
 * Replaces the inlined orchestration of `normalizedImageAtom` and
 * `positionedNormalizedImageAtom` in
 * `src/app/store/preview/pipeline/preview-image.ts`.
 *
 * No port (like `buildIndexBuffer` / `renderIndexBufferToImageData`): both are
 * pure, synchronous transformations. The canvas-backed helpers they call
 * (`getVisualRegionNormalized`, `positionImageForAutoMode`) are deterministic
 * image-processing functions invoked directly — the same way `ditherImage`
 * already calls `positionImageForAutoMode`. The atoms stay async only because
 * they await their upstream pipeline atoms.
 *
 * Both return `ImageData | null` directly (no `Result` union): the `null`
 * cases (no upstream image yet, or a degenerate zero-size scale) are
 * pipeline-availability concerns, not expected errors.
 *
 * Living registry: see `./README.md`.
 */

import type { ResizeMode } from '@/app/store/config/resize-types'
import type { CpcModeConfig } from '@/domain/cpc'
import type { ResampleStrategy } from '@/domain/image-processing'
import { positionImageForAutoMode } from '@/domain/image-processing'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { getVisualRegionNormalized } from '../get-visual-region'

export interface NormalizeImageInput {
  /** Smoothed source image; `null` while the pipeline has no image yet. */
  processed: ImageData | null
  /** Effective CPC mode config — drives the auto-mode scale. */
  modeConfig: CpcModeConfig
  /** Active resize mode; `origin`/`cover` already sit at CPC dimensions. */
  resizeMode: ResizeMode
  /** Auto-mode resampling strategy; `classic` uses the legacy canvas path. */
  resampleStrategy: ResampleStrategy
}

/**
 * Normalizes the smoothed image to CPC dimensions.
 *
 * In `origin`/`cover` the image is already at the target dimensions and is
 * returned untouched; in `auto` it is rescaled via `getVisualRegionNormalized`
 * (which itself returns `null` for a degenerate zero-size scale). The auto
 * downscale uses linear-light resampling for every pixel mode unless `classic`
 * is selected (legacy gamma canvas path → no filter passed).
 */
export function normalizeImage(input: NormalizeImageInput): ImageData | null {
  const { processed, modeConfig, resizeMode, resampleStrategy } = input

  if (!processed) return null

  if (resizeMode === 'origin' || resizeMode === 'cover') return processed

  const filter = resampleStrategy === 'classic' ? undefined : resampleStrategy
  return getVisualRegionNormalized(processed, modeConfig, filter)
}

export interface PositionNormalizedImageInput {
  /** Output of {@link normalizeImage}; `null` propagates straight through. */
  normalized: ImageData | null
  /** Effective CPC mode config — only `width`/`height` are consumed. */
  modeConfig: { width: number; height: number }
  /** Active resize mode; only `'auto'` triggers canvas positioning. */
  resizeMode: ResizeMode
  /** Export palette with slots — supplies the margin background color. */
  exportPalette: Vector[]
  centerImage: boolean
}

/**
 * Positions the normalized image into the target CPC canvas in `auto` mode so
 * its dimensions match the preview index buffer (required for raster indices to
 * line up); `origin`/`cover` already match and are returned untouched.
 */
export function positionNormalizedImage(
  input: PositionNormalizedImageInput
): ImageData | null {
  const { normalized, modeConfig, resizeMode, exportPalette, centerImage } =
    input

  if (!normalized) return null

  return resizeMode === 'auto'
    ? positionImageForAutoMode(
        normalized,
        modeConfig,
        exportPalette,
        centerImage
      )
    : normalized
}
