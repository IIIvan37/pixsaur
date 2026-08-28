/**
 * The sheet as a PNG (Q9 · Q10 · Q20).
 *
 * Its own module because the conversion is not the only thing that produces a
 * sheet: the edit layer repaints tiles, and the file has to follow. Indexed,
 * pre-stretched, source grid kept.
 */

import {
  CPC_MODE_CONFIG,
  type CpcModeKey,
  type PixelMode,
  perceptualDistance
} from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { encodeIndexedPng } from '@/libs/pixsaur-png'
import {
  assembleSheet,
  type SheetGrid,
  scaleSheetGutters
} from '@/libs/pixsaur-tileset'
import type { ConvertedTileset, TileSize } from './convert-tileset'
import { BLACK, type Pen } from './pens'

export interface RenderTilesetPngInput {
  /** Where the tiles sat in the source sheet — the grid the PNG restores. */
  source: SheetGrid
  target: TileSize
  mode: PixelMode
  /** What a hole was composited over; defaults to black (Q16). */
  background?: Pen
}

/**
 * Lays the tiles back out on the source grid (Q10) and pre-stretches CPC pixels
 * so the file opens undistorted in any viewer (Q9).
 */
export function renderTilesetPng(
  tileset: ConvertedTileset,
  input: RenderTilesetPngInput
): Uint8Array {
  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${input.mode}` as CpcModeKey]
  const { width, height, indices } = assembleSheet(
    tileset.tiles.map((tile) => tile.indices),
    {
      columns: tileset.columns,
      rows: tileset.rows,
      tile: input.target,
      gutters: scaleSheetGutters(input.source, input.target),
      stretch: { x: scaleX, y: scaleY },
      fill: gutterPen(tileset, input.background ?? BLACK)
    }
  )

  return encodeIndexedPng({
    width,
    height,
    palette: tileset.palette,
    indices,
    transparentIndex: tileset.transparentPen ?? undefined
  })
}

/**
 * What the blanks between the tiles are painted with: the hole pen when the
 * mode spends one, and otherwise the pen nearest the background — which is
 * what flattening a hole means in modes 1 and 2 (Q16).
 */
function gutterPen(tileset: ConvertedTileset, background: Pen): number {
  if (tileset.transparentPen !== null) return tileset.transparentPen

  let best = 0
  let shortest = Number.POSITIVE_INFINITY
  tileset.palette.forEach((pen, at) => {
    const distance = perceptualDistance(pen as Vector, background as Vector)
    if (distance < shortest) {
      shortest = distance
      best = at
    }
  })

  return best
}
