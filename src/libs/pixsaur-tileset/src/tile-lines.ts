/**
 * Reading a tile one line at a time — the shared vocabulary of the resize and
 * the edge detection, which both reason in whole columns and whole rows.
 */

import type { SourceTile, TileGrid } from './slice-sheet'

/** Pixel offsets of column `x`, top to bottom. */
export function columnOffsets(x: number, grid: TileGrid): number[] {
  return Array.from(
    { length: grid.tileHeight },
    (_, y) => y * grid.tileWidth + x
  )
}

/** Pixel offsets of row `y`, left to right. */
export function rowOffsets(y: number, grid: TileGrid): number[] {
  return Array.from(
    { length: grid.tileWidth },
    (_, x) => y * grid.tileWidth + x
  )
}

/** Mean squared RGBA distance between two lines of a tile. */
export function lineDistance(
  tile: SourceTile,
  a: readonly number[],
  b: readonly number[]
): number {
  let total = 0
  for (let i = 0; i < a.length; i++) {
    for (let channel = 0; channel < 4; channel++) {
      const delta =
        tile.data[a[i] * 4 + channel] - tile.data[b[i] * 4 + channel]
      total += delta * delta
    }
  }
  return total / a.length
}
