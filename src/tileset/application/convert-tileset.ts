/**
 * Converts a tileset sheet from another machine to CPC constraints.
 *
 * Pure, synchronous, total — no ports. The caller owns the side effects
 * (reading the source file, saving the produced PNG); this use-case only
 * computes. See `docs/features/PLAN-tileset-workshop.md`.
 */

import type { PixelMode } from '@/domain/cpc'
import { sliceSheet } from '@/libs/pixsaur-tileset'
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
  /** Tile size in the source sheet. */
  source: TileSize
  /** Tile size in the destination, in CPC pixels. */
  target: TileSize
  mode: PixelMode
  hardware: CPCHardware
}

/** One converted tile: palette indices, `target.tileWidth * tileHeight` long. */
export interface ConvertedTile {
  indices: Uint8Array
}

export interface ConvertedTileset {
  columns: number
  rows: number
  tiles: ConvertedTile[]
}

export type ConvertTilesetResult =
  | { ok: true; tileset: ConvertedTileset }
  | { ok: false; error: 'grid-mismatch' }

export function convertTileset(
  input: ConvertTilesetInput
): ConvertTilesetResult {
  const sliced = sliceSheet(input.sheet, input.source)
  if (!sliced) return { ok: false, error: 'grid-mismatch' }

  const { columns, rows, tiles } = sliced

  return {
    ok: true,
    tileset: {
      columns,
      rows,
      tiles: tiles.map(() => ({ indices: new Uint8Array(0) }))
    }
  }
}
