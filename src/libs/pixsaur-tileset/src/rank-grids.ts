/**
 * Ranks candidate grids by how many tiles they make repeat (Q29).
 *
 * The right grid is the one that maximises exact duplicates: a grid one pixel
 * off its tiles cuts every tile across two neighbours, and the duplicate rate
 * collapses. The criterion costs nothing — the dedup pass it reads is the same
 * one the edit layer needs. See `docs/features/PLAN-tileset-workshop.md`.
 *
 * Known bias: read across tile SIZES, the rate favours the smallest one — the
 * smaller the tile, the more likely two of them match. Compare offsets at a
 * fixed size, and treat sizes as a shortlist the user still arbitrates.
 */

import {
  type Sheet,
  type SheetGrid,
  sliceSheet,
  type TileGrid
} from './slice-sheet'
import { dedupeTiles, duplicateRate } from './tile-dedup'

/** The tile sizes worth trying on an unknown sheet, before the user says. */
export const PLAUSIBLE_TILE_SIZES: readonly TileGrid[] = [8, 16, 24, 32].map(
  (size) => ({ tileWidth: size, tileHeight: size })
)

export interface GridCandidate {
  grid: SheetGrid
  columns: number
  rows: number
  /** How many distinct tiles the grid leaves — what the tileset would cost. */
  uniqueTiles: number
  /** Share of the sliced tiles that repeat one already seen. */
  duplicateRate: number
}

/** Area of one tile, the tie-break: same rate, bigger tiles says more. */
function tileArea({ grid }: GridCandidate): number {
  return grid.tileWidth * grid.tileHeight
}

/**
 * Score every grid that slices `sheet`, best duplicate rate first. Grids no
 * whole tile fits are dropped rather than ranked last — they are not answers.
 */
export function rankTileGrids(
  sheet: Sheet,
  grids: readonly SheetGrid[]
): GridCandidate[] {
  const candidates: GridCandidate[] = []

  for (const grid of grids) {
    const sliced = sliceSheet(sheet, grid)
    if (!sliced) continue

    const dedup = dedupeTiles(sliced.tiles.map((tile) => tile.data))
    candidates.push({
      grid,
      columns: sliced.columns,
      rows: sliced.rows,
      uniqueTiles: dedup.unique.length,
      duplicateRate: duplicateRate(dedup)
    })
  }

  return candidates.sort(
    (a, b) => b.duplicateRate - a.duplicateRate || tileArea(b) - tileArea(a)
  )
}
