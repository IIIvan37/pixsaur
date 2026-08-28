/**
 * The sheet the workshop reads (Q6 · Q32).
 *
 * Its own atom space, deliberately: the tileset workshop and the image
 * workshop are two documents open at once, not two views of one. Sharing
 * `cpcMode` would make them tread on each other and make the palette freeze
 * of Q28 untenable.
 */

import { atom } from 'jotai'
import type { TilesetSheet } from '@/tileset'

/** The imported sheet, RGBA. `null` until the user drops a file. */
export const tilesetSheetAtom = atom<TilesetSheet | null>(null)

export const setTilesetSheetAtom = atom(
  null,
  (_get, set, payload: TilesetSheet | null) => {
    set(tilesetSheetAtom, payload)
  }
)
