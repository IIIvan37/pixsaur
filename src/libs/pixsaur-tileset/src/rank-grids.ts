/**
 * Ranks candidate grids by how many tiles they make repeat (Q29).
 *
 * The right grid is the one that maximises exact duplicates: a grid one pixel
 * off its tiles cuts every tile across two neighbours, and the duplicate rate
 * collapses. The criterion costs nothing — the dedup pass it reads is the same
 * one the edit layer needs. See `docs/features/PLAN-tileset-workshop.md`.
 *
 * The rate itself cannot rank one SIZE against another: the smaller the tile,
 * the more likely two of them match, so the smallest size wins by construction.
 * The ranking is therefore made on what the tileset would COST — the unique
 * tiles plus one index per position — which charges a small tile for the index
 * table it imposes. The rate stays reported: at a fixed size it is exact, and
 * it is what the offset comparison of Q29 reads.
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
  /**
   * What the converted tileset would weigh — the unique tiles plus one index
   * per position — over the area the grid actually covers. Lower is better;
   * this is what the ranking reads. Divided by the covered area, not by the
   * sheet: a grid that walks off the edge and slices fewer tiles would
   * otherwise look cheap for having dropped part of the sheet.
   */
  tilemapCost: number
}

/** Area of one tile, the tie-break: same cost, bigger tiles says more. */
function tileArea({ grid }: GridCandidate): number {
  return grid.tileWidth * grid.tileHeight
}

/**
 * Score every grid that slices `sheet`, cheapest tilemap first. Grids no whole
 * tile fits are dropped rather than ranked last — they are not answers.
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
    const positions = sliced.columns * sliced.rows
    const area = grid.tileWidth * grid.tileHeight
    const stored = dedup.unique.length * area
    candidates.push({
      grid,
      columns: sliced.columns,
      rows: sliced.rows,
      uniqueTiles: dedup.unique.length,
      duplicateRate: duplicateRate(dedup),
      tilemapCost: (stored + positions) / (positions * area)
    })
  }

  return candidates.sort(
    (a, b) => a.tilemapCost - b.tilemapCost || tileArea(b) - tileArea(a)
  )
}
