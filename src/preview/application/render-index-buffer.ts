/**
 * `renderIndexBufferToImageData` use-case — pure palette-index → RGBA rendering
 * for the preview pipeline (clean-archi strangler-fig).
 *
 * Replaces the inlined orchestration of `finalPreviewImageAtom` in
 * `src/app/store/preview/pipeline/index-buffer.ts`.
 *
 * **No port:** the render is a *pure* transformation (index buffer + palette →
 * `ImageData`) with no impure dependency — the recipe allows pure functions to
 * be called directly, so this use-case has no `deps`. (Contrast
 * `quantizePalette`/`ditherImage`, which wrap an impure processor/quantizer
 * behind a port.)
 *
 * **Synchronous** like `buildIndexBuffer`: a single pixel loop; the driving atom
 * stays async only to await its upstream pipeline atoms.
 *
 * **Total** (no `Result` union): given a valid `IndexBuffer` it always produces
 * an image — there is no expected failure. The "no input yet" case stays in the
 * adapter atom, where it reflects upstream pipeline availability.
 *
 * Living registry: see `./README.md`.
 */

import type { IndexBuffer } from './build-index-buffer'

/**
 * Renders an index buffer to an `ImageData` for display: each pixel's palette
 * index is resolved against the buffer's palette (missing entries fall back to
 * black), with full opacity. This is the non-raster preview render — the
 * per-line raster path lives in `@/libs/pixsaur-raster`.
 */
export function renderIndexBufferToImageData(
  indexBuffer: IndexBuffer
): ImageData {
  const { buffer, width, height, palette } = indexBuffer

  const imageData = new ImageData(width, height)
  const data = imageData.data

  for (let i = 0; i < buffer.length; i++) {
    const inkIndex = buffer[i]
    const color = palette[inkIndex] ?? [0, 0, 0]
    const pixelIndex = i * 4
    data[pixelIndex] = color[0] // R
    data[pixelIndex + 1] = color[1] // G
    data[pixelIndex + 2] = color[2] // B
    data[pixelIndex + 3] = 255 // A
  }

  return imageData
}
