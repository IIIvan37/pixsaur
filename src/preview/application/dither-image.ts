/**
 * `ditherImage` use-case — pure dithering for the preview pipeline
 * (clean-archi strangler-fig).
 *
 * Replaces the inlined orchestration of `previewImageAtom` in
 * `src/app/store/preview/pipeline/preview-image.ts`. The impure ditherer arrives
 * through the {@link ImageDitherer} port; every other step is pure domain logic
 * (`@/domain/cpc`, `@/domain/image-processing`).
 *
 * Synchronous on purpose: unlike `quantizePalette`, the underlying `dither` is a
 * synchronous call — wrapping it in a Promise would buy nothing. The atom that
 * drives it is still async because it awaits its upstream pipeline atoms.
 *
 * Living registry: see `./README.md`.
 */

import { findDarkestValidColor, replaceIgnoredSlots } from '@/domain/cpc'
import type { ResizeMode } from '@/domain/image-processing'
import { positionImageForAutoMode } from '@/domain/image-processing'
import type { DitheringConfig } from '@/libs/pixsaur-color/src'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { ImageDitherer } from './ports'

export interface DitherImageInput {
  /** Image normalized to CPC dimensions, ready to dither. */
  normalized: ImageData
  /** Export palette with slots (may contain `IGNORED_SLOT` markers). */
  exportPalette: Vector[]
  /** Effective dithering configuration. */
  dithering: DitheringConfig
  /** Effective CPC mode config — only `width`/`height` are consumed. */
  modeConfig: { width: number; height: number }
  /** Active resize mode; only `'auto'` triggers canvas positioning. */
  resizeMode: ResizeMode
  centerImage: boolean
}

export interface DitherImageDeps {
  ditherer: ImageDitherer
}

export type DitherImageResult =
  | { ok: true; image: ImageData }
  | { ok: false; error: string }

/**
 * Dithers the normalized image onto the export palette and places the result in
 * the target canvas when in `'auto'` resize mode (origin/cover already sit at
 * the target CPC dimensions).
 */
export function ditherImage(
  input: DitherImageInput,
  deps: DitherImageDeps
): DitherImageResult {
  const {
    normalized,
    exportPalette,
    dithering,
    modeConfig,
    resizeMode,
    centerImage
  } = input

  // Replace ignored slots [-1,-1,-1] with the darkest valid color so dithering
  // maps every pixel — same prep the index-buffer step uses.
  const ditheringPalette = replaceIgnoredSlots(
    exportPalette,
    findDarkestValidColor(exportPalette)
  )

  const previewBuffer = deps.ditherer.dither(
    normalized,
    ditheringPalette,
    dithering
  )

  // dither returns an RGB buffer at the normalized dimensions — no remapping.
  const remapped = new ImageData(
    new Uint8ClampedArray(previewBuffer),
    normalized.width,
    normalized.height
  )

  // In auto mode the dithered image (variable size) must be placed in the target
  // canvas (160x200 / 320x200); origin/cover already match the target.
  const image =
    resizeMode === 'auto'
      ? positionImageForAutoMode(
          remapped,
          modeConfig,
          exportPalette,
          centerImage
        )
      : remapped

  return { ok: true, image }
}
