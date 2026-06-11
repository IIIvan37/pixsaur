/**
 * `buildIndexBuffer` use-case — pure preview-image → palette-index conversion
 * for the preview pipeline (clean-archi strangler-fig).
 *
 * Replaces the inlined orchestration of `previewIndexBufferAtom` in
 * `src/app/store/preview/pipeline/index-buffer.ts`.
 *
 * **No port:** the conversion (`rgbToIndexBufferExact`) is a *pure* encoder from
 * `@/export/exports` — the recipe allows pure domain/libs/encoders to be called
 * directly, so this use-case has no impure dependency and therefore no `deps`.
 * (Contrast `quantizePalette`/`ditherImage`, which wrap an impure
 * processor/quantizer behind a port.)
 *
 * **Synchronous** like `ditherImage`: every step is a synchronous call; the
 * driving atom stays async only to await its upstream pipeline atoms.
 *
 * Living registry: see `./README.md`.
 */

import { findDarkestValidColor, replaceIgnoredSlots } from '@/domain/cpc'
import { rgbToIndexBufferExact } from '@/export'
import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * Index buffer of a preview image: one palette index per pixel, plus the
 * dimensions and the (ignored-slot-free) palette those indices map into.
 *
 * Canonical shape for the preview pipeline — the Jotai store re-exports it as
 * `IndexBufferData` (adapter depends on the application layer, not the reverse).
 */
export interface IndexBuffer {
  buffer: Uint8Array
  width: number
  height: number
  palette: Vector[]
}

export interface BuildIndexBufferInput {
  /** Dithered preview image at CPC dimensions (RGBA ImageData). */
  previewImage: ImageData
  /** Export palette with slots (may contain `IGNORED_SLOT` markers). */
  exportPalette: Vector[]
}

export type BuildIndexBufferResult =
  | { ok: true; indexBuffer: IndexBuffer }
  | { ok: false; error: string }

/**
 * Converts the already-quantized preview image into an index buffer suitable for
 * raster rendering (palette modification per line).
 */
export function buildIndexBuffer(
  input: BuildIndexBufferInput
): BuildIndexBufferResult {
  const { previewImage, exportPalette } = input

  if (exportPalette.length === 0) {
    return { ok: false, error: 'empty export palette' }
  }

  // Replace ignored slots [-1,-1,-1] with the darkest valid color so every pixel
  // maps — same prep the dither step uses (`@/domain/cpc`).
  const ditheringPalette = replaceIgnoredSlots(
    exportPalette,
    findDarkestValidColor(exportPalette)
  )

  // The image is already quantized, so disable per-pixel quantization (3rd arg
  // false) and fall back to the darkest color for any unmapped pixel (4th true).
  const buffer = rgbToIndexBufferExact(
    previewImage.data,
    ditheringPalette,
    false,
    true
  )

  return {
    ok: true,
    indexBuffer: {
      buffer,
      width: previewImage.width,
      height: previewImage.height,
      palette: ditheringPalette
    }
  }
}
