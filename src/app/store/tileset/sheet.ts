/**
 * The sheet the workshop reads (Q6 · Q32).
 *
 * Its own atom space, deliberately: the tileset workshop and the image
 * workshop are two documents open at once, not two views of one. Sharing
 * `cpcMode` would make them tread on each other and make the palette freeze
 * of Q28 untenable.
 */

import { atom } from 'jotai'
import { EMPTY_EDIT_LAYER, type TilesetSheet } from '@/tileset'
import { tilesetEditLayerAtom } from './edit-layer'

/** The imported sheet, RGBA. `null` until the user drops a file. */
export const tilesetSheetAtom = atom<TilesetSheet | null>(null)

/** Another sheet is another document: nothing painted on the last one holds. */
export const setTilesetSheetAtom = atom(
  null,
  (_get, set, payload: TilesetSheet | null) => {
    set(tilesetSheetAtom, payload)
    set(tilesetEditLayerAtom, EMPTY_EDIT_LAYER)
  }
)
