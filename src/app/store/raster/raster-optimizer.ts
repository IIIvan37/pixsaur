/**
 * Raster Auto-Optimization
 *
 * Thin Jotai adapter over the `optimizeRaster` use-case
 * (`src/raster/application/optimize-raster.ts`). It assembles the input from
 * atoms, injects the real id generator port, runs the pure optimization, then
 * writes the result back and toggles the mutually-exclusive render modes.
 */

import { atom } from 'jotai'
import { optimizeRaster } from '@/raster/application/optimize-raster'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  egxEnabledAtom,
  modeREnabledAtom
} from '../config/config'
import {
  exportPaletteWithSlotsAtom,
  positionedNormalizedImageAtom
} from '../preview/preview'
import { generateChangeId } from './raster-changes'
import {
  rasterChangesAtom,
  rasterDitheringIntensityAtom,
  rasterEnabledAtom,
  rasterMaxChangesPerLineAtom
} from './raster-config'
import {
  rasterOptimizationResultAtom,
  rasterVersionAtom
} from './raster-index-buffer'

/**
 * Action atom to auto-optimize raster changes for the current CPC mode.
 * Analyzes each line of the source image (before dithering) and generates
 * optimal per-line palettes.
 *
 * @param options.resetChanges - If true, clears existing changes before
 * optimizing (useful when dithering intensity changes).
 */
export const autoOptimizeRasterAtom = atom(
  null,
  async (get, set, options?: { resetChanges?: boolean }) => {
    // Get the positioned normalized image (source colors, before dithering):
    // the TRUE colors of each pixel that the raster palettes must represent.
    const sourceImage = await get(positionedNormalizedImageAtom)
    if (!sourceImage) {
      return { success: false, error: 'No image available' }
    }

    // Global palette from the same quantization as non-raster mode.
    const exportPalette = await get(exportPaletteWithSlotsAtom)

    const { optimizationResult, changes, changesCount, linesAffected } =
      optimizeRaster(
        {
          sourceImage,
          exportPalette,
          modeConfig: get(effectiveModeConfigAtom),
          hardware: get(cpcHardwareAtom),
          ditheringIntensity: get(rasterDitheringIntensityAtom),
          existingChanges: get(rasterChangesAtom),
          resetChanges: options?.resetChanges ?? false,
          maxChangesPerLine: get(rasterMaxChangesPerLineAtom)
        },
        { idGenerator: { generate: generateChangeId } }
      )

    // Store the raw optimization result (final dithering applied downstream by
    // rasterIndexBufferAtom).
    set(rasterOptimizationResultAtom, optimizationResult)

    // Replace all existing changes with the optimized ones.
    set(rasterChangesAtom, changes)

    // Force preview re-evaluation even when dimensions are unchanged.
    set(rasterVersionAtom, get(rasterVersionAtom) + 1)

    // Enable raster mode (mutually exclusive with Mode R and EGX).
    if (get(modeREnabledAtom)) set(modeREnabledAtom, false)
    if (get(egxEnabledAtom)) set(egxEnabledAtom, false)
    set(rasterEnabledAtom, true)

    return { success: true, changesCount, linesAffected }
  }
)
