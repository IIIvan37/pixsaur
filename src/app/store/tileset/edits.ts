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
  renderTilesetPng,
  undoTilesetEdits
} from '@/tileset'
import { tilesetModeAtom, tilesetOptionsAtom } from './config'
import { convertedTilesetAtom } from './conversion'
import { tilesetEditLayerAtom } from './edit-layer'
import { tilesetTargetAtom } from './geometry'
import { tilesetGridAtom } from './grid'

const systemClock: Clock = { now: () => Date.now() }

/**
 * The sheet as the workshop shows it: converted, then the layer laid over it.
 *
 * The PNG is encoded again on every stroke — the same order of work as the
 * conversion the sheet already runs on each keystroke (Q30).
 */
export const editedTilesetAtom = atom<ConvertTilesetResult | null>((get) => {
  const result = get(convertedTilesetAtom)
  if (!result?.ok) return result

  const target = get(tilesetTargetAtom)
  const tileset = applyTilesetEdits(
    result.tileset,
    get(tilesetEditLayerAtom),
    target
  )
  if (tileset === result.tileset) return result

  return {
    ok: true,
    tileset,
    png: renderTilesetPng(tileset, {
      source: get(tilesetGridAtom),
      target,
      mode: get(tilesetModeAtom),
      background: get(tilesetOptionsAtom).background
    })
  }
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
