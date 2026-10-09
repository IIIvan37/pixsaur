/**
 * The sheet the workshop reads (Q6 · Q32).
 *
 * Its own atom space, deliberately: the tileset workshop and the image
 * workshop are two documents open at once, not two views of one. Sharing
 * `cpcMode` would make them tread on each other and make the palette freeze
 * of Q28 untenable.
 */

import { atom } from 'jotai'
import { downscaleSheet, type Sheet } from '@/libs/pixsaur-tileset'
import { EMPTY_EDIT_LAYER, inspectSheet, type SheetInspection } from '@/tileset'
import { selectedTileAtom, tilesetEditLayerAtom } from './edit-layer'
import { tilesetStageZoomAtom } from './ui'

/** The imported sheet, RGBA. `null` until the user drops a file. */
export const tilesetSheetAtom = atom<Sheet | null>(null)

/**
 * The name of the file the sheet came from, for the workshop bar (S-Q8).
 * `null` when nothing names it — no sheet yet, or a project saved without one.
 */
export const tilesetSheetNameAtom = atom<string | null>(null)

/**
 * Another sheet is another document: nothing painted on the last one holds,
 * no tile of it is picked, and the stage fits it anew.
 */
export const setTilesetSheetAtom = atom(
  null,
  (_get, set, payload: Sheet | null, name: string | null = null) => {
    set(tilesetSheetAtom, payload)
    set(tilesetSheetNameAtom, payload ? name : null)
    set(tilesetEditLayerAtom, EMPTY_EDIT_LAYER)
    set(selectedTileAtom, null)
    set(tilesetStageZoomAtom, 'fit')
  }
)

/** What the workshop checks in the source before cutting it (M-Q19). */
export const tilesetSheetInspectionAtom = atom<SheetInspection | null>(
  (get) => {
    const sheet = get(tilesetSheetAtom)
    return sheet ? inspectSheet(sheet) : null
  }
)

/**
 * Undoes the whole factor the inspection found. The reduced image is another
 * sheet, so it goes through the same setter as an import — under the same
 * name: it is the same file, read at its own size.
 */
export const reduceTilesetSheetAtom = atom(null, (get, set) => {
  const sheet = get(tilesetSheetAtom)
  const scale = get(tilesetSheetInspectionAtom)?.scale
  if (!sheet || !scale) return

  set(
    setTilesetSheetAtom,
    downscaleSheet(sheet, scale),
    get(tilesetSheetNameAtom)
  )
})
