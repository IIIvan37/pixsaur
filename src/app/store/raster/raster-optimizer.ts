/**
 * Raster Auto-Optimization
 *
 * Automatically generates optimal raster changes for CPC images.
 * Analyzes each line to determine the best per-line palette modifications.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  MODE_0_FIXED_COLORS,
  MODE_0_TOTAL_COLORS,
  optimizeLinePalettesWithIndexBuffer,
  preprocessImageForRaster
} from '@/libs/pixsaur-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { cpcPalette } from '@/palettes/cpc-palette'
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
 * Action atom to auto-optimize raster changes for CPC Plus Mode 1.
 * Analyzes each line of the image and generates optimal 4-color palettes.
 * Only available when CPC Plus hardware AND Mode 1 (4 colors) are selected.
 *
 * Uses the source image (before dithering) to detect the actual colors needed
 * per line, then generates raster changes to adapt the palette.
 *
 * @param options.resetChanges - If true, clears existing changes before optimizing (useful when dithering changes)
 */
export const autoOptimizeRasterAtom = atom(
  null,
  async (get, set, options?: { resetChanges?: boolean }) => {
    logger.time('[RASTER] autoOptimizeRasterAtom - Total')

    const modeConfig = get(effectiveModeConfigAtom)
    const hardware = get(cpcHardwareAtom)

    // Determine if we're in CPC Classic mode (27 colors) or Plus mode (4096 colors)
    const isClassicMode = hardware === 'classic'
    // CPC Classic palette is used to constrain colors to the 27 hardware colors
    const cpcClassicPalette = isClassicMode ? cpcPalette : undefined

    logger.time('[RASTER] Get positioned image')
    // Get the positioned normalized image (source colors, before dithering)
    // This gives us the TRUE colors of each pixel that we need to represent
    const sourceImage = await get(positionedNormalizedImageAtom)
    logger.timeEnd('[RASTER] Get positioned image')

    if (!sourceImage) {
      logger.timeEnd('[RASTER] autoOptimizeRasterAtom - Total')
      return { success: false, error: 'No image available' }
    }

    // Use dimensions from sourceImage
    const { width, height } = sourceImage

    // Detect Mode 0 CPC Plus (16 colors, Plus hardware)
    // In this mode, only 12 colors are fixed (indices 4-15), indices 0-3 are raster slots
    const isMode0Plus =
      modeConfig.nColors === MODE_0_TOTAL_COLORS && hardware === 'plus'

    logger.time('[RASTER] Get/calculate palette')
    // Get the global palette from the same quantization as non-raster mode
    const exportPalette = await get(exportPaletteWithSlotsAtom)

    let globalPalette: Vector<'RGB'>[]

    if (isMode0Plus) {
      // Mode 0 CPC Plus: take the 12 best colors (first 12) for fixed palette
      // These will be placed at indices 4-15 by the optimizer
      // Indices 0-3 are raster slots that will be filled dynamically per line
      globalPalette = exportPalette
        .filter((c) => c[0] !== -1)
        .slice(0, MODE_0_FIXED_COLORS)

      // Pad to 12 colors if needed
      while (globalPalette.length < MODE_0_FIXED_COLORS) {
        globalPalette.push([0, 0, 0])
      }

      logger.info(
        '[RASTER] Mode 0 Plus: using first 12 colors for fixed palette',
        {
          paletteLength: globalPalette.length
        }
      )
    } else {
      // Standard modes (Mode 1, Mode 2, Mode 0 Classic): use export palette directly
      globalPalette = exportPalette
        .filter((c) => c[0] !== -1)
        .slice(0, modeConfig.nColors)

      // Pad to nColors if needed
      while (globalPalette.length < modeConfig.nColors) {
        globalPalette.push([0, 0, 0])
      }
    }
    logger.timeEnd('[RASTER] Get/calculate palette')

    // Get raster dithering intensity
    const ditheringIntensity = get(rasterDitheringIntensityAtom)

    logger.time('[RASTER] Preprocess image')
    // PRE-PROCESS: Transform source image to have max nColors per line
    // This ensures smooth palette transitions and better raster optimization
    const preprocessedImage = preprocessImageForRaster(
      sourceImage,
      globalPalette,
      {
        ditheringIntensity,
        nColors: modeConfig.nColors,
        cpcClassicPalette
      }
    )
    logger.timeEnd('[RASTER] Preprocess image')

    // Get existing raster changes (without IDs for the algorithm)
    // If resetChanges is true, start fresh (useful when dithering intensity changes)
    const existingChanges = options?.resetChanges
      ? []
      : get(rasterChangesAtom).map(({ line, inkIndex, color }) => ({
          line,
          inkIndex,
          color
        }))

    // Get max changes per line setting, clamped to hardware limit
    // CPC Classic: max 2 changes per line
    // CPC Plus: max 4 changes per line
    // Also limited by number of colors in current mode
    const hardwareMax = isClassicMode ? 2 : 4
    const maxAllowedChanges = Math.min(modeConfig.nColors, hardwareMax)
    const maxChangesPerLine = Math.min(
      get(rasterMaxChangesPerLineAtom),
      maxAllowedChanges
    )

    logger.time('[RASTER] Optimize line palettes')
    // Generate optimized raster changes AND matching index buffer
    // - preprocessedImage: image with max nColors per line (smooth transitions)
    // - globalPalette: initial nColors palette (from same quantization as non-raster mode)
    // - useProvidedPalette: true to reuse the same palette calculation as non-raster mode
    // - Returns both raster changes and an index buffer where each pixel
    //   maps to its correct ink index based on per-line palettes
    const {
      changes: optimizedChanges,
      indexBuffer: optimizedIndexBuffer,
      quantizedGlobalPalette
    } = optimizeLinePalettesWithIndexBuffer(
      preprocessedImage,
      globalPalette,
      existingChanges,
      {
        maxChangesPerLine,
        nColors: modeConfig.nColors,
        cpcClassicPalette,
        useProvidedPalette: true // Use the same palette as non-raster mode
      }
    )
    logger.timeEnd('[RASTER] Optimize line palettes')

    // Filter out any changes that exceed the mode height (safety check)
    const maxLine = modeConfig.height - 1
    const validChanges = optimizedChanges.filter(
      (c: Omit<RasterChange, 'id'>) => c.line <= maxLine
    )

    // Convert to full RasterChange with IDs
    // Preserve IDs for existing changes, generate new IDs for new changes
    const existingIds = new Map(
      get(rasterChangesAtom).map((c) => [`${c.line}-${c.inkIndex}`, c.id])
    )
    const newChanges: RasterChange[] = validChanges.map(
      (change: Omit<RasterChange, 'id'>) => ({
        ...change,
        id:
          existingIds.get(`${change.line}-${change.inkIndex}`) ??
          generateChangeId()
      })
    )

    // Store the raw optimization result (without final dithering)
    // The final dithering will be applied by rasterIndexBufferAtom
    set(rasterOptimizationResultAtom, {
      optimizedIndexBuffer,
      quantizedGlobalPalette,
      rasterChanges: validChanges,
      preprocessedImage,
      width,
      height
    })

    // Replace all existing changes with optimized ones
    set(rasterChangesAtom, newChanges)

    // Increment version to force preview re-evaluation
    const currentVersion = get(rasterVersionAtom)
    set(rasterVersionAtom, currentVersion + 1)

    // Enable raster mode (mutually exclusive with Mode R and EGX)
    if (get(modeREnabledAtom)) {
      set(modeREnabledAtom, false)
    }
    if (get(egxEnabledAtom)) {
      set(egxEnabledAtom, false)
    }
    set(rasterEnabledAtom, true)

    logger.timeEnd('[RASTER] autoOptimizeRasterAtom - Total')
    logger.info(
      `[RASTER] Optimization complete: ${newChanges.length} changes, ${new Set(newChanges.map((c) => c.line)).size} lines affected`
    )

    return {
      success: true,
      changesCount: newChanges.length,
      linesAffected: new Set(newChanges.map((c) => c.line)).size
    }
  }
)
