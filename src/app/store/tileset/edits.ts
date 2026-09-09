/**
 * Painting pens over the converted sheet (Q11 · Q19 · Q31).
 *
 * The workshop shows `editedTilesetAtom`, never the raw conversion: the layer
 * is replayed over the tiles every time anything upstream changes, which is
 * what lets a setting be reconsidered without losing the retouching.
 */

import { atom } from 'jotai'
import type { Point } from '@/editor/application/paint-pixels'
import type { Clock } from '@/editor/application/ports'
import {
  applyTilesetEdits,
  type ConvertTilesetResult,
  paintTileset,
  redoTilesetEdits,
  renderTilesetSheet,
  setTileDither,
  type TileDither,
  type TilesetSheet,
  undoTilesetEdits
} from '@/tileset'
import { tilesetModeAtom, tilesetOptionsAtom } from './config'
import { convertedTilesetAtom } from './conversion'
import { tilesetEditLayerAtom } from './edit-layer'
import { tilesetTargetAtom } from './geometry'
import { tilesetGridAtom } from './grid'

const systemClock: Clock = { now: () => Date.now() }

/** The sheet as the workshop shows it: converted, then the layer laid over it. */
export const editedTilesetAtom = atom<ConvertTilesetResult | null>((get) => {
  const result = get(convertedTilesetAtom)
  if (!result?.ok) return result

  const tileset = applyTilesetEdits(
    result.tileset,
    get(tilesetEditLayerAtom),
    get(tilesetTargetAtom)
  )
  if (tileset === result.tileset) return result

  return { ok: true, tileset }
})

/**
 * The same sheet as RGBA pixels — what the canvas draws and what the export
 * encodes (Q20).
 *
 * Derived rather than rendered in the view: a stroke redraws the sheet once,
 * and the export reads the very pixels the workshop is showing.
 */
export const renderedTilesetSheetAtom = atom<TilesetSheet | null>((get) => {
  const result = get(editedTilesetAtom)
  if (!result?.ok) return null

  return renderTilesetSheet(result.tileset, {
    source: get(tilesetGridAtom),
    target: get(tilesetTargetAtom),
    mode: get(tilesetModeAtom),
    background: get(tilesetOptionsAtom).background
  })
})

export interface PaintTilesetPayload {
  /** Position of the tile in the sheet. */
  tile: number
  /** Target pixels, in tile coordinates. */
  pixels: Point[]
  pen: number
}

export const paintTilesetAtom = atom(
  null,
  (get, set, payload: PaintTilesetPayload) => {
    const result = get(editedTilesetAtom)
    if (!result?.ok) return

    set(
      tilesetEditLayerAtom,
      paintTileset(
        {
          tileset: result.tileset,
          shape: get(tilesetTargetAtom),
          layer: get(tilesetEditLayerAtom),
          ...payload
        },
        { clock: systemClock }
      )
    )
  }
)

export const undoTilesetEditAtom = atom(null, (get, set) => {
  set(tilesetEditLayerAtom, undoTilesetEdits(get(tilesetEditLayerAtom)))
})

export const redoTilesetEditAtom = atom(null, (get, set) => {
  set(tilesetEditLayerAtom, redoTilesetEdits(get(tilesetEditLayerAtom)))
})

/**
 * The tile the retouching panel is aimed at, by position in the sheet.
 *
 * A position and not a unique tile: the collision report of Q22 names
 * positions, and it is what points the user at the tile worth retouching.
 */
export const selectedTileAtom = atom(0)

/** The pen the brush lays down — an index into the frozen palette (Q19). */
export const selectedPenAtom = atom(0)

export interface TileDitherPayload {
  tile: number
  /** `null` hands the tile back to the sheet-wide setting. */
  dither: TileDither | null
}

/**
 * The per-tile overrule of Q18 — the fan-out to every instance of the tile is
 * decided in `@/tileset`; the atom only hands it the conversion.
 */
export const setTileDitherAtom = atom(
  null,
  (get, set, { tile, dither }: TileDitherPayload) => {
    const result = get(convertedTilesetAtom)
    if (!result?.ok) return

    set(
      tilesetOptionsAtom,
      setTileDither({
        options: get(tilesetOptionsAtom),
        instanceOf: result.tileset.instanceOf,
        tile,
        dither
      })
    )
  }
)
