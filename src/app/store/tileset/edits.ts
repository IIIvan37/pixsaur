/**
 * Painting pens over the converted sheet (Q11 · Q19 · S-Q6).
 *
 * The workshop shows `editedTilesetAtom`, never the raw conversion: the layer
 * is laid over the tiles every time anything upstream changes, which is
 * what lets a setting be reconsidered without losing the retouching.
 */

import { atom } from 'jotai'
import type { Point } from '@/editor/application/paint-pixels'
import type { Sheet } from '@/libs/pixsaur-tileset'
import {
  applyTilesetEdits,
  type ConvertTilesetResult,
  paintTileset,
  renderTilesetSheet
} from '@/tileset'
import { convertedTilesetAtom, tilesetConversionInputAtom } from './conversion'
import { tilesetEditLayerAtom } from './edit-layer'
import { tilesetTargetAtom } from './geometry'

/** The sheet as the workshop shows it: converted, then the layer laid over it. */
export const editedTilesetAtom = atom<ConvertTilesetResult | null>((get) => {
  const result = get(convertedTilesetAtom)
  if (!result?.ok) return result

  const tileset = applyTilesetEdits(result.tileset, get(tilesetEditLayerAtom))
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
export const renderedTilesetSheetAtom = atom<Sheet | null>((get) => {
  const result = get(editedTilesetAtom)
  const input = get(tilesetConversionInputAtom)
  if (!result?.ok || !input) return null

  return renderTilesetSheet(result.tileset, input)
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
      paintTileset({
        tileset: result.tileset,
        shape: get(tilesetTargetAtom),
        layer: get(tilesetEditLayerAtom),
        ...payload
      })
    )
  }
)

/**
 * The tile the retouching panel is aimed at, by position in the sheet.
 *
 * A position and not a unique tile: a click on the map or the sheet names a
 * position, and the retouch reaches every position of the same tile.
 */
export const selectedTileAtom = atom(0)

/** The pen the brush lays down — an index into the frozen palette (Q19). */
export const selectedPenAtom = atom(0)
