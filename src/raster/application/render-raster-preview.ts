/**
 * Use-case: render the raster preview image from an index buffer.
 *
 * Pure orchestration extracted from `rasterPreviewImageAtom`
 * (`app/store/raster/raster-preview.ts`), where it was duplicated across two
 * branches (the auto-optimized raster buffer and the standard preview buffer).
 * Both branches did the same two steps, which this use-case unifies:
 *
 * 1. validate that the buffer dimensions still match the current mode config
 *    (a stale buffer after a mode/dimension change yields `null`),
 * 2. render the preview on the GPU via the {@link RasterRenderer} port when
 *    available, falling back to the pure CPU renderer if the port is absent or
 *    throws.
 *
 * Synchronous, total (`ImageData | null`), single impure dependency (the GPU
 * renderer, injected nullable). The atom adapter owns the atom reads, the
 * enabled/changes guards, and the choice of which index buffer to feed in.
 *
 * The GPU result is always copied into a fresh `ImageData` to avoid reusing a
 * texture-backed buffer that the GPU may recycle on the next frame.
 */

import { createRasterPreviewImageData } from '@/libs/pixsaur-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { IndexBuffer } from '@/preview/application/build-index-buffer'
import type { RasterRenderer } from './ports'

export interface RenderRasterPreviewInput {
  /** The index buffer to render (optimized raster buffer or standard preview). */
  indexBuffer: IndexBuffer
  /** Per-line raster changes to apply during rendering. */
  changes: RasterChange[]
  /** Current mode dimensions; a buffer that no longer matches is stale. */
  modeConfig: { width: number; height: number }
}

export type RenderRasterPreviewDeps = {
  /** GPU renderer, or `null` to render on the CPU only. */
  renderer: RasterRenderer | null
}

export function renderRasterPreview(
  input: RenderRasterPreviewInput,
  deps: RenderRasterPreviewDeps
): ImageData | null {
  const { indexBuffer, changes, modeConfig } = input

  // A buffer whose dimensions no longer match the mode config is stale (e.g.
  // the user changed dimensions after it was computed) — drop it.
  if (
    indexBuffer.width !== modeConfig.width ||
    indexBuffer.height !== modeConfig.height
  ) {
    return null
  }

  const { buffer, width, height, palette } = indexBuffer

  if (deps.renderer) {
    try {
      const preview = deps.renderer.renderRasterPreview(
        buffer,
        width,
        height,
        palette,
        changes
      )
      // Copy out of the (possibly texture-backed) GPU buffer.
      return new ImageData(
        new Uint8ClampedArray(preview.data),
        preview.width,
        preview.height
      )
    } catch {
      // GPU path failed — fall through to the CPU renderer.
    }
  }

  return createRasterPreviewImageData(buffer, width, height, palette, changes)
}
