/**
 * Picks the tiles close enough to merge (M-Q14 · M-Q15).
 *
 * A capture that went through a dither, or a level drawn by hand, leaves
 * tiles that differ by a few pixels. Each one costs a slot of the tileset.
 * The merge is greedy: tiles are taken from the most shown to the least, and
 * each one either joins the nearest tile already kept, under the threshold,
 * or is kept itself. A tile that joined another can take nobody in, so no
 * chain of small steps carries a tile far from what it ends up drawn as.
 *
 * Knows no machine: the distance between two tiles comes in as a parameter.
 * See `docs/features/PLAN-tileset-map.md`.
 */

import type { TileBytes } from './tile-dedup'

export interface TileMerge {
  /** Index of the tile that disappears. */
  absorbed: number
  /** Index of the tile its cells now show. */
  survivor: number
  distance: number
}

export interface MergeNearTilesInput {
  tiles: readonly TileBytes[]
  /** How many cells show each tile — the tile shown most is the one kept. */
  frequencies: readonly number[]
  distance: (a: TileBytes, b: TileBytes) => number
  /** Largest distance a merge may cover; 0 or less merges nothing. */
  threshold: number
  /** Pairs of indices never to merge, in either order. */
  excluded?: ReadonlyArray<readonly [number, number]>
}

export function mergeNearTiles({
  tiles,
  frequencies,
  distance,
  threshold,
  excluded = []
}: MergeNearTilesInput): TileMerge[] {
  if (threshold <= 0) return []

  const apart = new Set(
    excluded.flatMap(([a, b]) => [`${a}:${b}`, `${b}:${a}`])
  )
  // Most shown first; the first seen breaks a tie.
  const order = tiles
    .map((_, index) => index)
    .sort((a, b) => frequencies[b] - frequencies[a] || a - b)

  const survivors: number[] = []
  const merges: TileMerge[] = []

  for (const tile of order) {
    let nearest = -1
    let shortest = Number.POSITIVE_INFINITY
    for (const survivor of survivors) {
      if (apart.has(`${tile}:${survivor}`)) continue

      const gap = distance(tiles[tile], tiles[survivor])
      if (gap <= threshold && gap < shortest) {
        nearest = survivor
        shortest = gap
      }
    }

    if (nearest < 0) survivors.push(tile)
    else merges.push({ absorbed: tile, survivor: nearest, distance: shortest })
  }

  return merges
}
