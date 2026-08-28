/**
 * The edit layer of Q11 · Q19 · Q31: painting pens over a converted tileset.
 *
 * Pure, synchronous, total. Nothing is written into the converted tiles — the
 * edits are kept apart and replayed over them, because the palette is global
 * and the next requantization would otherwise throw the work away. Painting
 * one tile reaches every instance the deduplication found.
 * See `docs/features/PLAN-tileset-workshop.md`.
 */

import { type Point, paintPixels } from '@/editor/application/paint-pixels'
import type { Clock } from '@/editor/application/ports'
import { MAX_HISTORY_SIZE, type PixelEdit } from '@/editor/application/types'
import type { ConvertedTileset, TileSize } from './convert-tileset'

/**
 * One undoable action: the pixels it painted, and every tile position it
 * reached. The edits are listed once rather than per tile — the instances of a
 * group hold the same pixels, so the same strokes land identically on each.
 */
export interface TileStroke {
  /** Positions the stroke reached: an instance group of Q11, in sheet order. */
  tiles: number[]
  edits: PixelEdit[]
  timestamp: number
}

/**
 * The edits, in the order they were made, plus how far along the undo cursor
 * stands (Q31). Linear and global: one Ctrl+Z steps back one action, whichever
 * tile it touched.
 */
export interface TilesetEditLayer {
  strokes: TileStroke[]
  /** Index of the last stroke applied; -1 when nothing is. */
  at: number
}

export const EMPTY_EDIT_LAYER: TilesetEditLayer = { strokes: [], at: -1 }

export interface PaintTilesetInput {
  /** The tileset as it is shown — the layer already replayed over it. */
  tileset: ConvertedTileset
  shape: TileSize
  layer: TilesetEditLayer
  /** Position of the tile being painted, in the sheet. */
  tile: number
  /** Target pixels, in tile coordinates. */
  pixels: Point[]
  /** The pen to paint. An index into the frozen palette, never an RGB (Q19). */
  pen: number
}

export interface PaintTilesetDeps {
  clock: Clock
}

/** The positions holding the same tile as `tile`, itself included. */
function instancesOf(tileset: ConvertedTileset, tile: number): number[] {
  const group = tileset.instanceOf[tile]
  return tileset.instanceOf.flatMap((of, at) => (of === group ? [at] : []))
}

export function paintTileset(
  input: PaintTilesetInput,
  deps: PaintTilesetDeps
): TilesetEditLayer {
  const { tileset, shape, layer, tile, pixels, pen } = input
  // The palette is frozen and an edit is a pen INDEX: a pen the palette has
  // not got would repaint itself the next time the sheet is converted.
  if (pen < 0 || pen >= tileset.palette.length) return layer

  const { changed, edits } = paintPixels(
    {
      buffer: tileset.tiles[tile].indices,
      width: shape.tileWidth,
      height: shape.tileHeight,
      selectedInk: pen,
      egxConfig: null,
      pixels,
      entryType: 'region',
      expandLowResGroups: false,
      history: [],
      historyIndex: -1
    },
    deps
  )

  if (!changed) return layer

  const stroke: TileStroke = {
    tiles: instancesOf(tileset, tile),
    edits,
    timestamp: deps.clock.now()
  }

  return push(layer, stroke)
}

/**
 * Appends a stroke, dropping whatever the undo cursor had left behind: once a
 * new action is taken, the redone future is gone. Same cap as the image
 * editor, so the two workshops forget at the same depth.
 */
function push(layer: TilesetEditLayer, stroke: TileStroke): TilesetEditLayer {
  const strokes = [...layer.strokes.slice(0, layer.at + 1), stroke]
  if (strokes.length > MAX_HISTORY_SIZE) strokes.shift()

  return { strokes, at: strokes.length - 1 }
}

/** Steps the cursor back one action, whichever tile it had touched (Q31). */
export function undoTilesetEdits(layer: TilesetEditLayer): TilesetEditLayer {
  if (layer.at < 0) return layer

  return { ...layer, at: layer.at - 1 }
}

/** Steps the cursor forward, up to the last action taken. */
export function redoTilesetEdits(layer: TilesetEditLayer): TilesetEditLayer {
  if (layer.at >= layer.strokes.length - 1) return layer

  return { ...layer, at: layer.at + 1 }
}

/**
 * Replays the layer over the converted tiles (Q19).
 *
 * The conversion output is never mutated: the edits are laid over a copy, so
 * changing a setting reconverts from the source and the work survives. Only
 * the strokes up to the undo cursor are laid down.
 *
 * `instanceOf` is kept as the conversion found it, not recomputed on the
 * edited tiles: the edit link says "these were the same tile", and letting it
 * drift under the brush would move the group mid-stroke.
 */
export function applyTilesetEdits(
  tileset: ConvertedTileset,
  layer: TilesetEditLayer,
  shape: TileSize
): ConvertedTileset {
  const strokes = layer.strokes.slice(0, layer.at + 1)
  if (strokes.length === 0) return tileset

  const tiles = tileset.tiles.map(({ indices }) => ({
    indices: new Uint8Array(indices)
  }))

  for (const stroke of strokes) {
    for (const tile of stroke.tiles) {
      const target = tiles[tile]
      if (!target) continue
      for (const edit of stroke.edits) {
        const at = edit.y * shape.tileWidth + edit.x
        if (at < target.indices.length) target.indices[at] = edit.newInkIndex
      }
    }
  }

  return { ...tileset, tiles }
}
