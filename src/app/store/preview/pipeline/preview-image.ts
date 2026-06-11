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
import { positionImageForAutoMode } from '@/domain/image-processing'
import { getVisualRegionNormalized } from '@/preview'
import { ditherImage } from '@/preview/application/dither-image'
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

  // Auto downscale uses linear-light resampling for every pixel mode, unless
  // 'classic' is selected (legacy gamma canvas path → no filter passed).
  const filter = resampleStrategy === 'classic' ? undefined : resampleStrategy

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
 * Final preview image — thin adapter over the `ditherImage` use-case
 * (`@/preview/application/dither-image`). Assembles the input from atoms,
 * injects the real ditherer (`quantizerAtom`), and maps the result to state.
 *
 * Returns `null` when there is no quantizer or no normalized image yet.
 */
export const previewImageAtom = atom(async (get) => {
  const quantizer = await get(quantizerAtom)
  const normalized = await get(normalizedImageAtom)

  if (!quantizer || !normalized) {
    return null
  }

  const result = ditherImage(
    {
      normalized,
      // Use palette with slots so indices match export.
      exportPalette: await get(exportPaletteWithSlotsAtom),
      dithering: get(effectiveDitheringAtom),
      modeConfig: get(effectiveModeConfigAtom),
      resizeMode: get(resizeModeAtom),
      centerImage: get(centerImageAtom)
    },
    { ditherer: quantizer }
  )

  return result.ok ? result.image : null
})

// Re-export positionImageForAutoMode for backward compatibility
export { positionImageForAutoMode } from '@/domain/image-processing'
