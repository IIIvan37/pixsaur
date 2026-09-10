/**
 * The sheet as RGBA pixels (Q9 · Q10 · Q20).
 *
 * Its own module because the conversion is not the only thing that produces a
 * sheet: the edit layer repaints tiles, and the view has to follow. Truecolor,
 * pre-stretched, source grid kept.
 *
 * Truecolor and not indexed (Q20 reopened): the consumer downstream is
 * `img2cpc`, which snaps every colour to the nearest CPC one, so pen indices
 * buy it nothing — and every pen already comes out of `snapToHardware`, which
 * makes the round-trip the identity.
 */

import {
  CPC_MODE_CONFIG,
  type CpcModeKey,
  perceptualDistance
} from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  type AssembledSheet,
  assembleSheet,
  type Sheet,
  type SheetGutters,
  scaleSheetGutters
} from '@/libs/pixsaur-tileset'
import type {
  ConvertedTileset,
  TilesetConversionSubject
} from './convert-tileset'
import { BLACK, type Pen } from './pens'

/** What turns a pen into a colour: the palette, and which pen is the hole. */
type TilesetPens = Pick<ConvertedTileset, 'palette' | 'transparentPen'>

/**
 * The slice of the conversion the render needs — taken from the subject, so a
 * field renamed there stops compiling here instead of drifting.
 */
export type RenderTilesetSheetInput = Pick<
  TilesetConversionSubject,
  'source' | 'target' | 'mode'
> & {
  /** What a hole was composited over; defaults to black (Q16). */
  background?: Pen
}

/**
 * Lays the tiles back out on the source grid (Q10) and pre-stretches CPC pixels
 * so the sheet shows undistorted wherever it is drawn (Q9).
 *
 * Comes back in the same shape a source sheet goes in: an RGBA buffer a canvas
 * takes as is, through `putImageData`.
 */
export function renderTilesetSheet(
  tileset: ConvertedTileset,
  input: RenderTilesetSheetInput
): Sheet {
  return paint(
    assembleSheet(
      tileset.tiles.map((tile) => tile.indices),
      {
        columns: tileset.columns,
        rows: tileset.rows,
        tile: input.target,
        gutters: scaleSheetGutters(input.source, input.target),
        stretch: stretchOf(input.mode),
        fill: gutterPen(tileset, input.background ?? BLACK)
      }
    ),
    tileset
  )
}

export type RenderTileAtlasInput = Pick<
  TilesetConversionSubject,
  'target' | 'mode'
> & {
  /** The tiles to lay out, in reading order; `null` leaves its place blank. */
  tiles: readonly (Uint8Array | null)[]
  columns: number
  /** What a hole was composited over; defaults to black (Q16). */
  background?: Pen
}

/** An atlas has no blank anywhere — the source grid is not its layout. */
const NO_GUTTERS: SheetGutters = {
  leadingX: 0,
  leadingY: 0,
  trailingX: 0,
  trailingY: 0,
  gapX: 0,
  gapY: 0
}

/**
 * Lays the given tiles out edge to edge, pre-stretched like the sheet.
 *
 * What the Tiled export draws (M-Q11 · M-Q20): Tiled has one margin for both
 * axes, so a sheet whose two offsets differ has no exact description there,
 * and an atlas without gutters always has one.
 */
export function renderTileAtlas(
  tileset: TilesetPens,
  input: RenderTileAtlasInput
): Sheet {
  return paint(
    assembleSheet(input.tiles, {
      columns: input.columns,
      // One row at least: a map whose every cell is empty still needs an
      // image the canvas can encode.
      rows: Math.max(1, Math.ceil(input.tiles.length / input.columns)),
      tile: input.target,
      gutters: NO_GUTTERS,
      stretch: stretchOf(input.mode),
      fill: gutterPen(tileset, input.background ?? BLACK)
    }),
    tileset
  )
}

function stretchOf(mode: RenderTileAtlasInput['mode']) {
  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${mode}` as CpcModeKey]
  return { x: scaleX, y: scaleY }
}

/** Pens to RGBA, with the hole left fully transparent. */
function paint(
  { width, height, indices }: AssembledSheet,
  tileset: TilesetPens
): Sheet {
  const data = new Uint8ClampedArray(width * height * 4)
  indices.forEach((pen, at) => {
    const [red, green, blue] = tileset.palette[pen]
    data[at * 4] = red
    data[at * 4 + 1] = green
    data[at * 4 + 2] = blue
    // Alpha 0 is what carries the hole now that no palette chunk can (Q16).
    data[at * 4 + 3] = pen === tileset.transparentPen ? 0 : 255
  })

  return { width, height, data }
}

/**
 * What the blanks between the tiles are painted with: the hole pen when the
 * mode spends one, and otherwise the pen nearest the background — which is
 * what flattening a hole means in modes 1 and 2 (Q16).
 */
function gutterPen(tileset: TilesetPens, background: Pen): number {
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
