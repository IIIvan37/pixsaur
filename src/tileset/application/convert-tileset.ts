/**
 * Converts a tileset sheet from another machine to CPC constraints.
 *
 * Pure, synchronous, total — no ports. The caller owns the side effects
 * (reading the source file, saving the produced PNG); this use-case only
 * computes. See `docs/features/PLAN-tileset-workshop.md`.
 */

import {
  CPC_MODE_CONFIG,
  type CpcModeKey,
  colorToKey,
  type PixelMode,
  quantizeColorForHardware
} from '@/domain/cpc'
import { encodeIndexedPng } from '@/libs/pixsaur-png'
import {
  chooseResizeScheme,
  dedupeTiles,
  detectTileEdges,
  type EdgeCondition,
  resizeTileByScheme,
  resizeTileNearest,
  type SheetGrid,
  type SourceTile,
  sliceSheet,
  type TileEdges
} from '@/libs/pixsaur-tileset'
import type { CPCHardware } from '@/libs/types'

/** An RGBA sheet: `data` is `width * height * 4` bytes. */
export interface TilesetSheet {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** Tile dimensions, in pixels of the space they belong to. */
export interface TileSize {
  tileWidth: number
  tileHeight: number
}

export interface ConvertTilesetInput {
  sheet: TilesetSheet
  /** Where the tiles sit in the source sheet: size, margin, spacing, offset. */
  source: SheetGrid
  /** Tile size in the destination, in CPC pixels. */
  target: TileSize
  mode: PixelMode
  hardware: CPCHardware
  /**
   * How pixels are dropped when the tile shrinks. `columns` is the flagship
   * search of Q12; `nearest` is the phase-locked baseline it is compared
   * against. Defaults to `columns`.
   */
  resize?: 'columns' | 'nearest'
}

/** One converted tile: palette indices, `target.tileWidth * tileHeight` long. */
export interface ConvertedTile {
  indices: Uint8Array
}

/** An RGB pen, already snapped to a CPC hardware colour. */
export type Pen = [r: number, g: number, b: number]

export interface ConvertedTileset {
  columns: number
  rows: number
  /** Shared by every tile — the CPC has one palette at a time. */
  palette: Pen[]
  tiles: ConvertedTile[]
  /** For each tile, the tile it is an instance of — the edit link of Q11. */
  instanceOf: number[]
  /** Positions of the distinct tiles, in order of first appearance. */
  unique: number[]
}

export type ConvertTilesetResult =
  | { ok: true; tileset: ConvertedTileset; png: Uint8Array }
  | { ok: false; error: 'grid-mismatch' | 'palette-overflow' }

export function convertTileset(
  input: ConvertTilesetInput
): ConvertTilesetResult {
  const sliced = sliceSheet(input.sheet, input.source)
  if (!sliced) return { ok: false, error: 'grid-mismatch' }

  const { columns, rows, tiles } = sliced
  const scheme =
    input.resize === 'nearest'
      ? null
      : chooseResizeScheme(
          tiles,
          input.source,
          input.target,
          sheetEdges(tiles, input.source)
        )
  const maxPens = CPC_MODE_CONFIG[`${input.mode}` as CpcModeKey].nColors

  // T1 builds the shared palette by first-seen order. The real strategy —
  // histogram over UNIQUE tiles, reservation, freezing — lands in T5.
  const palette: Pen[] = []
  const penByKey = new Map<string, number>()

  const converted: ConvertedTile[] = []
  for (const tile of tiles) {
    const resized = scheme
      ? resizeTileByScheme(tile, input.source, input.target, scheme)
      : resizeTileNearest(tile, input.source, input.target)
    const indices = new Uint8Array(resized.data.length / 4)

    for (let pixel = 0; pixel < indices.length; pixel++) {
      const at = pixel * 4
      const [r, g, b] = quantizeColorForHardware(
        [resized.data[at], resized.data[at + 1], resized.data[at + 2]],
        input.hardware
      )
      const pen: Pen = [r, g, b]
      const key = colorToKey(pen)

      let index = penByKey.get(key)
      if (index === undefined) {
        if (palette.length >= maxPens) {
          return { ok: false, error: 'palette-overflow' }
        }
        index = palette.length
        penByKey.set(key, index)
        palette.push(pen)
      }
      indices[pixel] = index
    }

    converted.push({ indices })
  }

  // Deduplicating the CONVERTED tiles, not the source ones: two source tiles
  // that only differed below the CPC palette's resolution have become the same
  // tile, and editing one must reach the other (Q11).
  const { instanceOf, unique } = dedupeTiles(converted.map((t) => t.indices))

  const tileset: ConvertedTileset = {
    columns,
    rows,
    palette,
    tiles: converted,
    instanceOf,
    unique
  }

  return { ok: true, tileset, png: renderPng(tileset, input) }
}

/**
 * One edge condition per axis for the whole sheet, decided by majority (Q13).
 * The removal scheme is shared by every tile (Q14), so it can only be scored
 * under a single edge condition — a sheet that is mostly terrain is treated as
 * terrain. Per-tile edges would need a per-tile cost attribution; see the plan.
 */
function sheetEdges(tiles: SourceTile[], grid: SheetGrid): TileEdges {
  const verdicts = tiles.map((tile) => detectTileEdges(tile, grid))
  const majority = (axis: keyof TileEdges): EdgeCondition =>
    verdicts.filter((edge) => edge[axis] === 'wrap').length * 2 >=
    verdicts.length
      ? 'wrap'
      : 'clamp'

  return { horizontal: majority('horizontal'), vertical: majority('vertical') }
}

/**
 * Lays the tiles back out on the source grid (Q10) and pre-stretches CPC pixels
 * so the file opens undistorted in any viewer (Q9).
 */
function renderPng(
  tileset: ConvertedTileset,
  input: ConvertTilesetInput
): Uint8Array {
  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${input.mode}` as CpcModeKey]
  const tileW = input.target.tileWidth
  const tileH = input.target.tileHeight
  const width = tileset.columns * tileW * scaleX
  const height = tileset.rows * tileH * scaleY
  const indices = new Uint8Array(width * height)

  tileset.tiles.forEach((tile, at) => {
    const originX = (at % tileset.columns) * tileW * scaleX
    const originY = Math.floor(at / tileset.columns) * tileH * scaleY

    for (let y = 0; y < tileH; y++) {
      for (let x = 0; x < tileW; x++) {
        const pen = tile.indices[y * tileW + x]
        for (let dy = 0; dy < scaleY; dy++) {
          const row = (originY + y * scaleY + dy) * width + originX + x * scaleX
          indices.fill(pen, row, row + scaleX)
        }
      }
    }
  })

  return encodeIndexedPng({ width, height, palette: tileset.palette, indices })
}
