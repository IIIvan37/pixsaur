/**
 * Reads a grid of tiles as a map: which distinct tiles it holds, and which of
 * them each cell shows.
 *
 * The deduplication is exact, with no flip (M-Q6): a CPC cannot mirror a tile
 * without spending CPU on it. See `docs/features/PLAN-tileset-map.md`.
 */

import { dedupeTiles, type TileBytes } from './tile-dedup'

export interface TileMap {
  /** For each cell, in reading order, the index in `tiles` of what it shows. */
  cells: number[]
  /**
   * The cell each distinct tile first appears in, in that order — the order
   * the tileset is laid out in (M-Q12).
   */
  tiles: number[]
}

export function buildTileMap(tiles: readonly TileBytes[]): TileMap {
  const { instanceOf, unique } = dedupeTiles(tiles)
  const indexOf = new Map(unique.map((cell, index) => [cell, index]))

  return {
    cells: instanceOf.map((cell) => indexOf.get(cell) as number),
    tiles: unique
  }
}
