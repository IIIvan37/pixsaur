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

function countedPixels(tile: TileBytes, ignore?: number): number {
  if (ignore === undefined) return tile.length

  let counted = 0
  for (let pixel = 0; pixel < tile.length; pixel++) {
    if (tile[pixel] !== ignore) counted++
  }
  return counted
}

export interface HistogramOptions {
  /** A colour that competes for no pen — the transparency marker of Q16. */
  ignore?: number
}

export function tilePaletteHistogram(
  tiles: readonly TileBytes[],
  { ignore }: HistogramOptions = {}
): ColourWeight[] {
  const { unique } = dedupeTiles(tiles)
  // A tile holding nothing but holes carries no colour, so it must not take a
  // share of the total either — otherwise a sheet's blank tiles would dilute
  // the weights of the ones that do hold something.
  const counting = unique
    .map((at) => ({
      tile: tiles[at],
      counted: countedPixels(tiles[at], ignore)
    }))
    .filter(({ counted }) => counted > 0)
  const weights = new Map<number, number>()

  for (const { tile, counted } of counting) {
    const share = 1 / (counted * counting.length)
    for (let pixel = 0; pixel < tile.length; pixel++) {
      if (tile[pixel] === ignore) continue
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
