/**
 * Use-case: auto-optimize raster changes for a CPC image.
 *
 * Pure orchestration extracted from `autoOptimizeRasterAtom`
 * (`app/store/raster/raster-optimizer.ts`). Given the source image (before
 * dithering), the global export palette and the current raster settings, it:
 *
 * 1. derives the fixed global palette (Mode 0 Plus keeps 12 fixed colors, the
 *    rest of the modes use the full `nColors` budget),
 * 2. preprocesses the image so every line respects the per-line color limit,
 * 3. runs the line-palette optimizer to produce both the optimized index buffer
 *    and the per-line raster changes,
 * 4. assigns stable ids — preserving the id of any change already present on the
 *    same `(line, inkIndex)`, minting a new one (via the {@link IdGenerator}
 *    port) otherwise.
 *
 * Synchronous, total, single impure dependency (id generation). The atom adapter
 * handles the "no image" / atom reads / state writes and the enable/disable of
 * the mutually-exclusive render modes.
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  MODE_0_FIXED_COLORS,
  MODE_0_TOTAL_COLORS,
  optimizeLinePalettesWithIndexBuffer,
  preprocessImageForRaster
} from '@/libs/pixsaur-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { cpcPalette } from '@/palettes/cpc-palette'
import type { IdGenerator } from './ports'

export interface OptimizeRasterInput {
  /** Positioned, normalized source image (true colors, before dithering). */
  sourceImage: ImageData
  /** Global export palette (same quantization as non-raster mode). */
  exportPalette: Vector<'RGB'>[]
  /** Effective mode config: color budget per line and image height. */
  modeConfig: { nColors: number; height: number }
  /** CPC hardware target; `'classic'` constrains colors to the 27 hw colors. */
  hardware: 'classic' | 'plus'
  /** Internal raster dithering intensity (0 = none, 1 = full). */
  ditheringIntensity: number
  /** Current raster changes (with ids) — source of preserved ids. */
  existingChanges: RasterChange[]
  /** If true, optimize from scratch instead of refining `existingChanges`. */
  resetChanges: boolean
  /** User-requested max ink changes per line (clamped to the hw limit here). */
  maxChangesPerLine: number
}

export type OptimizeRasterDeps = {
  idGenerator: IdGenerator
}

/**
 * Raw optimization result (without final dithering), stored verbatim by the
 * adapter into `rasterOptimizationResultAtom`. The final dithering is applied
 * downstream by `rasterIndexBufferAtom`.
 */
export interface RasterOptimizationResult {
  optimizedIndexBuffer: Uint8Array
  quantizedGlobalPalette: Vector<'RGB'>[]
  rasterChanges: Array<Omit<RasterChange, 'id'>>
  preprocessedImage: ImageData
  width: number
  height: number
}

export interface OptimizeRasterResult {
  /** Raw result to store for downstream dithering. */
  optimizationResult: RasterOptimizationResult
  /** Full raster changes (with ids) to replace the current set. */
  changes: RasterChange[]
  changesCount: number
  linesAffected: number
}

export function optimizeRaster(
  input: OptimizeRasterInput,
  deps: OptimizeRasterDeps
): OptimizeRasterResult {
  const {
    sourceImage,
    exportPalette,
    modeConfig,
    hardware,
    ditheringIntensity,
    existingChanges,
    resetChanges,
    maxChangesPerLine
  } = input

  const isClassicMode = hardware === 'classic'
  // CPC Classic constrains colors to the 27 hardware colors; Plus is unconstrained.
  const cpcClassicPalette = isClassicMode ? cpcPalette : undefined

  const { width, height } = sourceImage

  // Mode 0 CPC Plus: only 12 colors are fixed (indices 4-15); indices 0-3 are
  // raster slots filled dynamically per line. Other modes use the full budget.
  const isMode0Plus =
    modeConfig.nColors === MODE_0_TOTAL_COLORS && hardware === 'plus'
  const fixedColorCount = isMode0Plus ? MODE_0_FIXED_COLORS : modeConfig.nColors

  const globalPalette = exportPalette
    .filter((c) => c[0] !== -1)
    .slice(0, fixedColorCount)
  while (globalPalette.length < fixedColorCount) {
    globalPalette.push([0, 0, 0])
  }

  // Transform the source so each line respects the per-line color limit
  // (smoother palette transitions, better optimization).
  const preprocessedImage = preprocessImageForRaster(
    sourceImage,
    globalPalette,
    {
      ditheringIntensity,
      nColors: modeConfig.nColors,
      cpcClassicPalette
    }
  )

  // Refine the existing changes, or start fresh when resetting.
  const baseChanges = resetChanges
    ? []
    : existingChanges.map(({ line, inkIndex, color }) => ({
        line,
        inkIndex,
        color
      }))

  // Clamp to the hardware limit (Classic: 2, Plus: 4) and the mode color count.
  const hardwareMax = isClassicMode ? 2 : 4
  const maxAllowedChanges = Math.min(modeConfig.nColors, hardwareMax)
  const effectiveMaxChanges = Math.min(maxChangesPerLine, maxAllowedChanges)

  const {
    changes: optimizedChanges,
    indexBuffer: optimizedIndexBuffer,
    quantizedGlobalPalette
  } = optimizeLinePalettesWithIndexBuffer(
    preprocessedImage,
    globalPalette,
    baseChanges,
    {
      maxChangesPerLine: effectiveMaxChanges,
      nColors: modeConfig.nColors,
      cpcClassicPalette,
      useProvidedPalette: true
    }
  )

  // Safety: drop any change beyond the mode height.
  const maxLine = modeConfig.height - 1
  const validChanges = optimizedChanges.filter((c) => c.line <= maxLine)

  // Preserve ids of changes already present on the same (line, inkIndex);
  // ids are sourced from the current set even when refining from scratch.
  const existingIds = new Map(
    existingChanges.map((c) => [`${c.line}-${c.inkIndex}`, c.id])
  )
  const changes: RasterChange[] = validChanges.map((change) => ({
    ...change,
    id:
      existingIds.get(`${change.line}-${change.inkIndex}`) ??
      deps.idGenerator.generate()
  }))

  return {
    optimizationResult: {
      optimizedIndexBuffer,
      quantizedGlobalPalette,
      rasterChanges: validChanges,
      preprocessedImage,
      width,
      height
    },
    changes,
    changesCount: changes.length,
    linesAffected: new Set(changes.map((c) => c.line)).size
  }
}
