/**
 * The edit layer of Q11 · Q19 · S-Q6: painting pens over a converted tileset.
 *
 * Pure, synchronous, total. Nothing is written into the converted tiles — the
 * edits are kept apart and laid over them, because the palette is global and
 * the next requantization would otherwise throw the work away. Painting one
 * tile reaches every instance the deduplication found.
 * See `docs/features/PLAN-tileset-stage.md`.
 */

import type { Point } from '@/editor/application/paint-pixels'
import type { TileGrid } from '@/libs/pixsaur-tileset'
import type { ConvertedTileset } from './convert-tileset'

/**
 * The pens painted over the sheet: for each tile position, the pen each
 * painted pixel holds, keyed by `y * tileWidth + x`.
 *
 * A table of what the pixels hold, not a list of what the brush did (S-Q6):
 * its size is bounded by the sheet, never by the number of strokes, so no
 * retouch is ever dropped to make room for a later one. Plain objects, so the
 * project writes it as JSON as it stands.
 */
export type TilesetEditLayer = Readonly<
  Record<number, Readonly<Record<number, number>>>
>

export const EMPTY_EDIT_LAYER: TilesetEditLayer = {}

export interface PaintTilesetInput {
  /** The tileset as it is shown — the layer already laid over it. */
  tileset: ConvertedTileset
  shape: TileGrid
  layer: TilesetEditLayer
  /** Position of the tile being painted, in the sheet. */
  tile: number
  pixels: Point[]
  /** Index into the frozen palette. */
  pen: number
}

/** The positions sharing the tile's group, the tile itself included. */
function instancesOf(tileset: ConvertedTileset, tile: number): number[] {
  const group = tileset.instanceOf[tile]
  return tileset.instanceOf.flatMap((of, at) => (of === group ? [at] : []))
}

/**
 * Writes `pen` over `pixels` on every instance of `tile`. The positions are
 * the ones the deduplication grouped at the moment of painting.
 *
 * Returns `layer` itself when nothing would change: a pen the palette has not
 * got, pixels outside the tile, or pixels that already hold the pen.
 */
export function paintTileset({
  tileset,
  shape,
  layer,
  tile,
  pixels,
  pen
}: PaintTilesetInput): TilesetEditLayer {
  const indices = tileset.tiles[tile]?.indices
  if (!indices || pen < 0 || pen >= tileset.palette.length) return layer

  const painted = pixels
    .filter(
      ({ x, y }) =>
        x >= 0 && x < shape.tileWidth && y >= 0 && y < shape.tileHeight
    )
    .map(({ x, y }) => y * shape.tileWidth + x)
    .filter((at) => indices[at] !== pen)
  if (painted.length === 0) return layer

  const next: Record<number, Readonly<Record<number, number>>> = { ...layer }
  for (const position of instancesOf(tileset, tile)) {
    const pens = { ...next[position] }
    for (const at of painted) pens[at] = pen
    next[position] = pens
  }
  return next
}

/**
 * Lays the layer over the converted tiles (Q19).
 *
 * The conversion output is never mutated: the edits are laid over a copy, so
 * changing a setting reconverts from the source and the work survives.
 *
 * `instanceOf` is kept as the conversion found it, not recomputed on the
 * edited tiles: the edit link says "these were the same tile", and letting it
 * drift under the brush would move the group mid-stroke.
 */
export function applyTilesetEdits(
  tileset: ConvertedTileset,
  layer: TilesetEditLayer
): ConvertedTileset {
  const positions = Object.keys(layer)
  if (positions.length === 0) return tileset

  const tiles = tileset.tiles.map(({ indices }) => ({
    indices: new Uint8Array(indices)
  }))
  for (const position of positions) {
    const target = tiles[Number(position)]
    if (!target) continue
    for (const [at, pen] of Object.entries(layer[Number(position)])) {
      if (Number(at) < target.indices.length) target.indices[Number(at)] = pen
    }
  }

  return { ...tileset, tiles }
}
