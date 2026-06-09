/**
 * Preview image atoms for preview pipeline.
 *
 * Handles the final stages of preview generation:
 * - Normalized image (scaled to CPC dimensions)
 * - Positioned normalized image (for raster optimization)
 * - Effective dithering configuration
 * - Final preview image with dithering applied
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import { positionImageForAutoMode } from '@/domain/image-processing'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { luminance } from '@/libs/pixsaur-color/src/utils/luminance'
import { getVisualRegionNormalized } from '@/preview'
import {
  autoDistinctMappingAtom,
  centerImageAtom,
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  resampleStrategyAtom,
  resizeModeAtom
} from '../../config/config'
import { smoothedImageAtom } from './image-pipeline'
import { exportPaletteWithSlotsAtom } from './palette-export'
import { quantizerAtom } from './quantization'

// ============================================================================
// NORMALIZED IMAGE
// ============================================================================

/**
 * Image normalized to CPC dimensions (before dithering).
 * Used for line-by-line raster optimization.
 */
export const normalizedImageAtom = atom(async (get) => {
  const modeConfig = get(effectiveModeConfigAtom)
  const resizeMode = get(resizeModeAtom)
  const resampleStrategy = get(resampleStrategyAtom)
  const processed = await get(smoothedImageAtom)

  if (!processed) return null

  // Mode 0 auto downscale uses linear-light resampling; other modes unchanged.
  const filter = modeConfig.mode === 0 ? resampleStrategy : undefined

  // In origin and cover modes, image is already at correct CPC dimensions
  // In auto mode, normalize to CPC dimensions
  const normalized =
    resizeMode === 'origin' || resizeMode === 'cover'
      ? processed
      : getVisualRegionNormalized(processed, modeConfig, filter)

  return normalized
})

/**
 * Positioned normalized image (same dimensions as previewImage).
 * Used for raster optimization - must have exact same dimensions
 * as previewIndexBufferAtom for indices to match.
 */
export const positionedNormalizedImageAtom = atom(async (get) => {
  const modeConfig = get(effectiveModeConfigAtom)
  const normalized = await get(normalizedImageAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)
  const exportPalette = await get(exportPaletteWithSlotsAtom)

  if (!normalized) return null

  // In auto mode, apply same positioning as previewImageAtom
  if (resizeMode === 'auto') {
    return positionImageForAutoMode(
      normalized,
      modeConfig,
      exportPalette,
      centerImage
    )
  }

  return normalized
})

// ============================================================================
// DITHERING CONFIGURATION
// ============================================================================

/**
 * Effective dithering configuration.
 * Returns the user-configured dithering settings.
 * In raster mode, this dithering is applied AFTER raster optimization
 * using per-line palettes.
 * When autoDistinctMapping is enabled (CPC Classic + Mode 0), dithering is forced to 'none'
 * to preserve exact color mapping.
 */
export const effectiveDitheringAtom = atom((get) => {
  const dithering = get(ditheringAtom)
  const autoDistinctMapping = get(autoDistinctMappingAtom)
  const cpcHardware = get(cpcHardwareAtom)
  const modeConfig = get(effectiveModeConfigAtom)

  // Force no dithering when distinct-mapping is active (CPC Classic + Mode 0)
  const isDistinctMappingActive =
    autoDistinctMapping &&
    cpcHardware === 'classic' &&
    modeConfig.nColors === 16

  if (isDistinctMappingActive) {
    return { mode: 'none' as const, intensity: 0 }
  }

  return dithering
})

// ============================================================================
// FINAL PREVIEW IMAGE
// ============================================================================

/**
 * Final preview image with optimized dithering cache.
 * Applies dithering to the normalized image using the quantizer.
 */
export const previewImageAtom = atom(async (get) => {
  const modeConfig = get(effectiveModeConfigAtom)
  const quantizer = await get(quantizerAtom)
  // Use palette with slots so indices match export
  const exportPalette = await get(exportPaletteWithSlotsAtom)
  const normalized = await get(normalizedImageAtom)
  const dithering = get(effectiveDitheringAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)

  if (!quantizer || !normalized) {
    return null
  }

  // Prepare palette for dithering: replace ignored slots [-1,-1,-1]
  // with a valid color (black) for dithering to work
  const validColors = exportPalette.filter(
    (c) => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
  )
  const fallbackColor: Vector =
    validColors.length > 0
      ? validColors.reduce((darkest, color) => {
          return luminance(color) < luminance(darkest) ? color : darkest
        }, validColors[0])
      : [0, 0, 0]

  // Palette for dithering: same structure as export but with fallback for ignored
  const ditheringPalette = exportPalette.map((color) =>
    color[0] === -1 ? fallbackColor : color
  )

  logger.time('dithering')
  const previewBuffer = quantizer.dither(
    normalized,
    ditheringPalette,
    dithering
  )
  logger.timeEnd('dithering')

  // Dithering returns RGB buffer, no remapping needed!
  const remapped = new ImageData(
    new Uint8ClampedArray(previewBuffer),
    normalized.width,
    normalized.height
  )

  // Positioning for auto mode (origin and cover handle their own positioning)
  // In auto mode, getVisualRegionNormalized returns variable-sized ImageData (scaledW × scaledH)
  // that must be placed in canvas at target size (160x200 or 320x200)
  if (resizeMode === 'auto') {
    return positionImageForAutoMode(
      remapped,
      modeConfig,
      exportPalette,
      centerImage
    )
  }

  return remapped
})

// Re-export positionImageForAutoMode for backward compatibility
export { positionImageForAutoMode } from '@/domain/image-processing'
