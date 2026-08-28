import type { TileBytes } from './tile-dedup'

/** How far one tile ended up from the colours it asked for. */
export interface TileCollision {
  /** Position of the tile in the sheet. */
  tile: number
  /** Mean error over the tile's pixels, in the caller's own unit. */
  error: number
}

export interface CollisionOptions {
  /** A colour that carries no error — the transparency marker of Q16. */
  ignore?: number
}

export function rankTileCollisions(
  tiles: readonly TileBytes[],
  unique: readonly number[],
  errorOf: ArrayLike<number>,
  { ignore }: CollisionOptions = {}
): TileCollision[] {
  const ranked = unique.map((tile) => {
    let total = 0
    let counted = 0
    for (let pixel = 0; pixel < tiles[tile].length; pixel++) {
      if (tiles[tile][pixel] === ignore) continue
      total += errorOf[tiles[tile][pixel]]
      counted++
    }
    return { tile, error: counted === 0 ? 0 : total / counted }
  })

  // Worst first — the report exists to point the manual retouching at the
  // tiles the palette hurt most (Q22). Ties keep sheet order, so the ranking
  // never depends on how the tiles were enumerated.
  return ranked.sort((a, b) => b.error - a.error || a.tile - b.tile)
}
