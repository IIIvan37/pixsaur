/**
 * Nearest-neighbour resize of a single tile.
 *
 * Sampling is **tile-local**: the destination grid always starts at the tile's
 * own origin, so two identical source tiles always produce identical output —
 * the property a whole-sheet resize cannot offer, and the one the whole slice
 * depends on. See `docs/features/PLAN-tileset-workshop.md`.
 *
 * The exhaustive column-selection resize arrives in T4; this is the baseline
 * every other strategy is compared against.
 */

import type { SourceTile, TileGrid } from './slice-sheet'

export function resizeTileNearest(
  tile: SourceTile,
  from: TileGrid,
  to: TileGrid
): SourceTile {
  const data = new Uint8ClampedArray(to.tileWidth * to.tileHeight * 4)

  for (let y = 0; y < to.tileHeight; y++) {
    const sourceY = Math.floor((y * from.tileHeight) / to.tileHeight)
    for (let x = 0; x < to.tileWidth; x++) {
      const sourceX = Math.floor((x * from.tileWidth) / to.tileWidth)
      const source = (sourceY * from.tileWidth + sourceX) * 4
      const target = (y * to.tileWidth + x) * 4
      data.set(tile.data.subarray(source, source + 4), target)
    }
  }

  return { data }
}
