/**
 * Advises on the grid that reads the source sheet (T3 — dedup and grid).
 *
 * The grid stays manual (Q5): the user declares tile size, margin, spacing and
 * offset. This use-case only ranks the plausible tile sizes against that
 * declaration, on the duplicate rate — a grid landing on the tiles repeats
 * them, a grid one pixel off repeats nothing (Q29).
 * See `docs/features/PLAN-tileset-workshop.md`.
 */

import {
  type GridCandidate,
  PLAUSIBLE_TILE_SIZES,
  rankTileGrids,
  type SheetGrid,
  type TileGrid
} from '@/libs/pixsaur-tileset'
import type { TilesetSheet } from './convert-tileset'

/** The blanks of a grid — everything but the tile size itself. */
export type GridBlanks = Omit<SheetGrid, 'tileWidth' | 'tileHeight'>

export interface SuggestTileGridInput {
  sheet: TilesetSheet
  /** What the user declared around the tiles; kept for every candidate size. */
  blanks?: GridBlanks
  /** Tile sizes to try — the usual tileset divisors by default. */
  sizes?: readonly TileGrid[]
}

export function suggestTileGrid({
  sheet,
  blanks,
  sizes = PLAUSIBLE_TILE_SIZES
}: SuggestTileGridInput): GridCandidate[] {
  return rankTileGrids(
    sheet,
    sizes.map((size) => ({ ...blanks, ...size }))
  )
}
