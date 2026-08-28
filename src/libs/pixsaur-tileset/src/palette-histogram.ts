/**
 * Weighs the base-palette colours of a tileset, one unit per UNIQUE tile
 * (Q3 · Q15).
 *
 * Counting pixels over the whole sheet would let a plain sky tile repeated
 * forty times flatten the histogram and erase the characters' colours. So each
 * DISTINCT tile carries a total weight of 1, split across its own pixels: the
 * instance count drops out, the proportions inside a tile survive.
 *
 * Tiles arrive as base-palette indices, already snapped to the hardware — this
 * module knows nothing of the CPC. See `docs/features/PLAN-tileset-workshop.md`.
 */

import { dedupeTiles, type TileBytes } from './tile-dedup'

/** A colour of the base palette, and the share of the weight it carries. */
export interface ColourWeight {
  index: number
  /** 0-1, summing to 1 over the whole result. */
  frequency: number
}

export function tilePaletteHistogram(
  tiles: readonly TileBytes[]
): ColourWeight[] {
  const { unique } = dedupeTiles(tiles)
  const weights = new Map<number, number>()

  for (const at of unique) {
    const tile = tiles[at]
    const share = 1 / (tile.length * unique.length)
    for (let pixel = 0; pixel < tile.length; pixel++) {
      weights.set(tile[pixel], (weights.get(tile[pixel]) ?? 0) + share)
    }
  }

  // Heaviest first, ties broken by palette index: the strategies of
  // pixsaur-color read their candidates in order, so the order must not
  // depend on which pixel the sheet happened to hold first (Q30).
  return [...weights]
    .map(([index, frequency]) => ({ index, frequency }))
    .sort((a, b) => b.frequency - a.frequency || a.index - b.index)
}
