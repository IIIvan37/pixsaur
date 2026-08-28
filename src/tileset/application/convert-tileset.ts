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
  resizeTileNearest,
  type SheetGrid,
  sliceSheet
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
  const maxPens = CPC_MODE_CONFIG[`${input.mode}` as CpcModeKey].nColors

  // T1 builds the shared palette by first-seen order. The real strategy —
  // histogram over UNIQUE tiles, reservation, freezing — lands in T5.
  const palette: Pen[] = []
  const penByKey = new Map<string, number>()

  const converted: ConvertedTile[] = []
  for (const tile of tiles) {
    const resized = resizeTileNearest(tile, input.source, input.target)
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

  const tileset: ConvertedTileset = {
    columns,
    rows,
    palette,
    tiles: converted
  }

  return { ok: true, tileset, png: renderPng(tileset, input) }
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
