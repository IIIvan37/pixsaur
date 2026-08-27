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
import { ditherImage } from '@/preview/application/dither-image'
import {
  normalizeImage,
  positionNormalizedImage
} from '@/preview/application/normalize-image'
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
import { quantizerAtom, sourceColorMappingAtom } from './quantization'

// ============================================================================
// NORMALIZED IMAGE
// ============================================================================

/**
 * Image normalized to CPC dimensions (before dithering).
 * Used for line-by-line raster optimization.
 */
export const normalizedImageAtom = atom(async (get) =>
  normalizeImage({
    processed: await get(smoothedImageAtom),
    modeConfig: get(effectiveModeConfigAtom),
    resizeMode: get(resizeModeAtom),
    resampleStrategy: get(resampleStrategyAtom)
  })
)

/**
 * Positioned normalized image (same dimensions as previewImage).
 * Used for raster optimization - must have exact same dimensions
 * as previewIndexBufferAtom for indices to match.
 */
export const positionedNormalizedImageAtom = atom(async (get) =>
  positionNormalizedImage({
    normalized: await get(normalizedImageAtom),
    modeConfig: get(effectiveModeConfigAtom),
    resizeMode: get(resizeModeAtom),
    exportPalette: await get(exportPaletteWithSlotsAtom),
    centerImage: get(centerImageAtom)
  })
)

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
 *
 * **Standard path only.** EGX, Mode R and the raster buffer read `ditheringAtom`
 * raw — see `distinctMappingForcesNoDither` in
 * `@/preview/application/rendering-path`, which declares that asymmetry.
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
  const sourceColorMapping = await get(sourceColorMappingAtom)

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
      centerImage: get(centerImageAtom),
      sourceColorMapping
    },
    { ditherer: quantizer }
  )

  return result.ok ? result.image : null
})

// Re-export positionImageForAutoMode for backward compatibility
export { positionImageForAutoMode } from '@/domain/image-processing'
