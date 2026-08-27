/**
 * Raster Preview Atoms
 *
 * Handles preview image generation with raster effects applied. Selecting
 * between the rendering paths lives in
 * `app/store/preview/effective-rendering.ts`.
 */

import { atom } from 'jotai'
import { renderRasterPreview } from '@/raster/application/render-raster-preview'
import { imageProcessorAtom } from '../adapters/processors'
import { effectiveModeConfigAtom } from '../config/config'
import {
  exportPaletteWithSlotsAtom,
  finalPreviewIndexBufferAtom
} from '../preview/preview'
import { rasterChangesAtom, rasterEnabledAtom } from './raster-config'
import {
  finalRasterIndexBufferAtom,
  rasterOptimizationResultAtom,
  rasterVersionAtom
} from './raster-index-buffer'

/**
 * Derived atom: raster preview image
 * Returns an ImageData with raster effects applied, or null if rasters are disabled
 *
 * Uses the optimized rasterIndexBuffer when available (from auto-optimization),
 * otherwise falls back to the standard previewIndexBuffer.
 */
export const rasterPreviewImageAtom = atom(async (get) => {
  const enabled = get(rasterEnabledAtom)
  const changes = get(rasterChangesAtom)

  // Explicitly depend on optimization result AND version to force re-evaluation.
  get(rasterOptimizationResultAtom)
  get(rasterVersionAtom)

  if (!enabled || changes.length === 0) {
    return null
  }

  // Depend on the export palette so the preview recomputes once it is ready.
  const exportPalette = await get(exportPaletteWithSlotsAtom)
  if (exportPalette.length === 0) {
    return null
  }

  const modeConfig = get(effectiveModeConfigAtom)
  const deps = { renderer: get(imageProcessorAtom) }
  const dims = { width: modeConfig.width, height: modeConfig.height }

  // Prefer the optimized raster buffer (with manual edits); fall back to the
  // standard preview buffer for purely manual raster changes.
  const rasterIndexBuffer = get(finalRasterIndexBufferAtom)
  if (rasterIndexBuffer) {
    return renderRasterPreview(
      { indexBuffer: rasterIndexBuffer, changes, modeConfig: dims },
      deps
    )
  }

  const indexBufferData = await get(finalPreviewIndexBufferAtom)
  if (!indexBufferData) {
    return null
  }
  return renderRasterPreview(
    { indexBuffer: indexBufferData, changes, modeConfig: dims },
    deps
  )
})
