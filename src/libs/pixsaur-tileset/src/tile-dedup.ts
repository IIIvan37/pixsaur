/**
 * Finds the tiles a sheet repeats, and links every instance to one
 * representative (Q11).
 *
 * Two things ride on this: the edit layer, where painting one tile must reach
 * its N instances, and the grid ranking of Q29, which reads the duplicate rate
 * as its only criterion. Both need the answer to be exact, so the hash only
 * groups candidates — byte equality decides. See
 * `docs/features/PLAN-tileset-workshop.md`.
 */

/** A tile as a flat run of numbers: RGBA bytes before conversion, palette
 * indices after — up to 4095 on Plus, so not always byte-sized. */
export type TileBytes = ArrayLike<number>

export interface TileDedup {
  /** For each tile, the position of the tile it is an instance of. */
  instanceOf: number[]
  /** Positions of the first occurrence of each distinct tile, in order. */
  unique: number[]
}

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** FNV-1a over the whole tile — cheap, and identical on every machine (Q30). */
function hashTile(bytes: TileBytes): number {
  let hash = FNV_OFFSET
  for (let at = 0; at < bytes.length; at++) {
    hash = Math.imul(hash ^ bytes[at], FNV_PRIME)
  }
  return hash >>> 0
}

function sameBytes(a: TileBytes, b: TileBytes): boolean {
  if (a.length !== b.length) return false
  for (let at = 0; at < a.length; at++) {
    if (a[at] !== b[at]) return false
  }
  return true
}

export function dedupeTiles(tiles: readonly TileBytes[]): TileDedup {
  const buckets = new Map<number, number[]>()
  const instanceOf: number[] = []
  const unique: number[] = []

  tiles.forEach((tile, at) => {
    const hash = hashTile(tile)
    const bucket = buckets.get(hash)
    const twin = bucket?.find((other) => sameBytes(tiles[other], tile))

    if (twin === undefined) {
      instanceOf.push(at)
      unique.push(at)
      if (bucket) bucket.push(at)
      else buckets.set(hash, [at])
    } else {
      instanceOf.push(twin)
    }
  })

  return { instanceOf, unique }
}

/** Share of the tiles that repeat one already seen — the criterion of Q29. */
export function duplicateRate({ instanceOf, unique }: TileDedup): number {
  if (instanceOf.length === 0) return 0
  return 1 - unique.length / instanceOf.length
}
