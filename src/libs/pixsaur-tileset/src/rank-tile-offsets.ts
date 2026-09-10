/**
 * Ranks the offsets a map's grid could start at (M-Q4).
 *
 * A capture rarely starts on its tiles: a status bar, the scroll or the crop
 * moves the grid. Cut at the right offset, the cells of a level repeat. Cut
 * one pixel off, every cell straddles two tiles and matches almost nothing.
 * The share of unique tiles collapses at the right offset — the one signal
 * this reads. See `docs/features/PLAN-tileset-map.md`.
 */

import { type Sheet, sliceSheet, type TileGrid } from './slice-sheet'
import { dedupeTiles } from './tile-dedup'

export interface OffsetCandidate {
  offsetX: number
  offsetY: number
  /** How many distinct tiles the cut leaves. */
  uniqueTiles: number
  /** How many cells the cut makes. */
  tiles: number
  /**
   * `uniqueTiles / tiles` — what the ranking reads. A share and not a count:
   * each offset drops a different strip at the edges, so the cell counts
   * differ from one offset to the next.
   */
  uniqueRate: number
}

export interface OffsetSearch {
  sheet: Sheet
  tile: TileGrid
}

/**
 * Every offset within one tile, fewest unique tiles first. Past one tile an
 * offset repeats the cut of its remainder, one row or column short.
 */
export function rankTileOffsets({
  sheet,
  tile
}: OffsetSearch): OffsetCandidate[] {
  const candidates: OffsetCandidate[] = []

  for (let offsetY = 0; offsetY < tile.tileHeight; offsetY++) {
    for (let offsetX = 0; offsetX < tile.tileWidth; offsetX++) {
      const sliced = sliceSheet(sheet, { ...tile, offsetX, offsetY })
      if (!sliced) continue

      const { unique } = dedupeTiles(sliced.tiles.map(({ data }) => data))
      candidates.push({
        offsetX,
        offsetY,
        uniqueTiles: unique.length,
        tiles: sliced.tiles.length,
        uniqueRate: unique.length / sliced.tiles.length
      })
    }
  }

  // Same share: the smaller shift drops the least of the image.
  return candidates.sort(
    (a, b) =>
      a.uniqueRate - b.uniqueRate ||
      a.offsetX + a.offsetY - (b.offsetX + b.offsetY)
  )
}
