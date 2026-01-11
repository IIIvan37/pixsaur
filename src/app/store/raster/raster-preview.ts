/**
 * Raster Preview Atoms
 *
 * Handles preview image generation with raster effects applied.
 * Provides the effective preview atom that selects the right preview based on mode.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster'
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

  // Explicitly depend on optimization result AND version to force re-evaluation
  const optimizationResult = get(rasterOptimizationResultAtom)
  const version = get(rasterVersionAtom)

  logger.debug('[RASTER] rasterPreviewImageAtom evaluation', {
    enabled,
    changesCount: changes.length,
    hasOptimizationResult: !!optimizationResult,
    version
  })

  if (!enabled || changes.length === 0) {
    logger.debug('[RASTER] rasterPreviewImageAtom returning null', {
      reason: enabled ? 'no changes' : 'disabled'
    })
    return null
  }

  // Get the export palette for rendering
  const exportPalette = await get(exportPaletteWithSlotsAtom)
  if (exportPalette.length === 0) {
    return null
  }

  // Get current mode config to validate dimensions
  const modeConfig = get(effectiveModeConfigAtom)

  // Check if we have an optimized raster index buffer (with manual edits applied)
  const rasterIndexBuffer = get(finalRasterIndexBufferAtom)

  if (rasterIndexBuffer) {
    logger.debug('[RASTER] Using optimized raster index buffer', {
      bufferWidth: rasterIndexBuffer.width,
      bufferHeight: rasterIndexBuffer.height,
      modeWidth: modeConfig.width,
      modeHeight: modeConfig.height
    })

    // Validate that buffer dimensions match current mode config
    if (
      rasterIndexBuffer.width !== modeConfig.width ||
      rasterIndexBuffer.height !== modeConfig.height
    ) {
      // Dimensions changed, buffer is stale - return null
      logger.debug('[RASTER] Buffer dimensions mismatch, returning null')
      return null
    }

    // Use the optimized index buffer from auto-optimization
    // This ensures pixel-to-ink mapping is consistent with raster changes
    const { buffer, width, height, palette } = rasterIndexBuffer
    const processor = get(imageProcessorAtom)
    if (processor) {
      try {
        const preview = processor.renderRasterPreview(
          buffer,
          width,
          height,
          palette,
          changes
        )
        logger.debug('[RASTER] GPU preview rendered successfully')
        // Force creation of new ImageData to avoid GPU cache issues
        return new ImageData(
          new Uint8ClampedArray(preview.data),
          preview.width,
          preview.height
        )
      } catch (error_) {
        // Fallback CPU if GPU path fails
        logger.warn('[RASTER] GPU preview failed, falling back to CPU', {
          error: error_
        })
      }
    }
    const preview = createRasterPreviewImageData(
      buffer,
      width,
      height,
      palette,
      changes
    )
    return preview
  }

  // Fallback to standard preview index buffer for manual raster changes
  const indexBufferData = await get(finalPreviewIndexBufferAtom)
  if (!indexBufferData) {
    return null
  }

  // Validate that buffer dimensions match current mode config
  if (
    indexBufferData.width !== modeConfig.width ||
    indexBufferData.height !== modeConfig.height
  ) {
    // Dimensions changed, buffer is stale - return null
    return null
  }

  const { buffer, width, height, palette } = indexBufferData
  const processor = get(imageProcessorAtom)
  if (processor) {
    try {
      return processor.renderRasterPreview(
        buffer,
        width,
        height,
        palette,
        changes
      )
    } catch (error_) {
      // Fallback CPU if GPU path fails
      logger.warn('[RASTER] GPU render failed, falling back to CPU', {
        error: error_
      })
    }
  }
  return createRasterPreviewImageData(buffer, width, height, palette, changes)
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
