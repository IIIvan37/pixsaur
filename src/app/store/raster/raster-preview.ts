/**
 * Raster Preview Atoms
 *
 * Handles preview image generation with raster effects applied.
 * Provides the effective preview atom that selects the right preview based on mode.
 */

import { atom } from 'jotai'
import { renderRasterPreview } from '@/raster/application/render-raster-preview'
import { imageProcessorAtom } from '../adapters/processors'
import {
  effectiveModeConfigAtom,
  egxEnabledAtom,
  modeREnabledAtom
} from '../config/config'
import { finalEgxPreviewImageAtom } from '../preview/egx-preview'
import { modeRPreviewImageAtom } from '../preview/mode-r-preview'
import {
  exportPaletteWithSlotsAtom,
  finalPreviewImageAtom,
  finalPreviewIndexBufferAtom,
  hasManualEditsAtom,
  previewImageAtom
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

/**
 * Effective preview image atom: returns the appropriate preview based on mode.
 * Priority: Mode R > EGX > Raster > Manual Edits > Standard
 * Note: Mode R, EGX and Raster are mutually exclusive
 */
export const effectivePreviewImageAtom = atom(async (get) => {
  // Mode R takes priority and is incompatible with rasters/EGX
  const modeREnabled = get(modeREnabledAtom)
  if (modeREnabled) {
    const modeRPreview = await get(modeRPreviewImageAtom)
    if (modeRPreview) {
      return modeRPreview
    }
  }

  // EGX mode (line-by-line mode alternation)
  // Always use finalEgxPreviewImageAtom to include manual edits
  const egxEnabled = get(egxEnabledAtom)
  if (egxEnabled) {
    const finalEgxPreview = await get(finalEgxPreviewImageAtom)
    if (finalEgxPreview) {
      return finalEgxPreview
    }
  }

  // Force re-evaluation when raster version changes
  get(rasterVersionAtom)

  const rasterPreview = await get(rasterPreviewImageAtom)
  if (rasterPreview) {
    return rasterPreview
  }

  // Check if there are manual edits - if so, use final preview image
  const hasEdits = get(hasManualEditsAtom)
  if (hasEdits) {
    return await get(finalPreviewImageAtom)
  }

  return await get(previewImageAtom)
})
