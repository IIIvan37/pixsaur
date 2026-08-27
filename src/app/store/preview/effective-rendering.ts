/**
 * Effective rendering — the one place that picks a rendering path.
 *
 * Pixsaur renders through four mutually exclusive paths (standard, raster, EGX,
 * Mode R). Which one is active used to be re-derived from the raw config flags
 * at six different call sites, each with its own precedence — and they did not
 * agree. This module derives it once, from
 * `@/preview/application/rendering-path`, and dispatches the two surfaces every
 * consumer needs: the displayed image and the editable index buffer.
 *
 * It lives in the preview slice (which owns three of the four paths) but is
 * deliberately **not** re-exported by `preview.ts`: it depends on the raster
 * slice, which depends on that hub in turn.
 */

import { atom, type Getter } from 'jotai'
import {
  finalRasterIndexBufferAtom,
  rasterVersionAtom
} from '../raster/raster-index-buffer'
import { rasterPreviewImageAtom } from '../raster/raster-preview'
import {
  finalEgxIndexBufferAtom,
  finalEgxPreviewImageAtom
} from './egx-preview'
import { modeRPreviewImageAtom } from './mode-r-preview'
import {
  finalPreviewImageAtom,
  finalPreviewIndexBufferAtom,
  hasManualEditsAtom,
  previewImageAtom
} from './preview'
import { activeRenderingPathAtom } from './rendering-path'

/**
 * The image the active path produces, or `null` while it is still computing.
 * `'standard'` returns `null` here: the standard preview is the fallback below,
 * not a special case.
 */
async function activePathImage(get: Getter): Promise<ImageData | null> {
  switch (get(activeRenderingPathAtom)) {
    case 'mode-r':
      return await get(modeRPreviewImageAtom)
    case 'egx':
      return await get(finalEgxPreviewImageAtom)
    case 'raster':
      return await get(rasterPreviewImageAtom)
    case 'standard':
      return null
  }
}

/**
 * The preview image to display: the active path's own image, falling back to
 * the standard pipeline.
 *
 * The fallback is not a precedence rule — it covers the frames where the active
 * path has not produced an image yet (still quantizing, palette not ready), so
 * the canvas keeps showing something instead of blanking.
 */
export const effectivePreviewImageAtom = atom(async (get) => {
  // Re-evaluate when a raster optimization lands, even at equal dimensions.
  get(rasterVersionAtom)

  const pathImage = await activePathImage(get)
  if (pathImage) return pathImage

  return get(hasManualEditsAtom)
    ? await get(finalPreviewImageAtom)
    : await get(previewImageAtom)
})

/**
 * The index buffer the pixel editor works on: one palette index per pixel for
 * the active path, with manual edits already applied.
 *
 * `null` when the active path declares no single index buffer — that is Mode R,
 * which produces two.
 */
export const effectiveIndexBufferAtom = atom(async (get) => {
  switch (get(activeRenderingPathAtom)) {
    case 'mode-r':
      // Declared gap: two frames, two buffers, nothing to hand the editor.
      // See `renderingPathCapabilities('mode-r').indexBuffer`.
      return null
    case 'egx':
      return (
        (await get(finalEgxIndexBufferAtom)) ??
        (await get(finalPreviewIndexBufferAtom))
      )
    case 'raster':
      return (
        get(finalRasterIndexBufferAtom) ??
        (await get(finalPreviewIndexBufferAtom))
      )
    case 'standard':
      return await get(finalPreviewIndexBufferAtom)
  }
})
