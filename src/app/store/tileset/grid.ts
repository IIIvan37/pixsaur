/**
 * How the sheet is cut into tiles (Q5 · Q29).
 *
 * The grid stays declared by hand; the suggestions only rank the plausible
 * tile sizes against the sheet, on the duplicate rate.
 */

import { atom } from 'jotai'
import type { GridCandidate, SheetGrid } from '@/libs/pixsaur-tileset'
import { suggestTileGrid } from '@/tileset'
import { tilesetSheetAtom } from './sheet'

const DEFAULT_GRID: SheetGrid = { tileWidth: 8, tileHeight: 8 }

export const tilesetGridAtom = atom<SheetGrid>(DEFAULT_GRID)

export const setTilesetGridAtom = atom(
  null,
  (get, set, payload: Partial<SheetGrid>) => {
    set(tilesetGridAtom, { ...get(tilesetGridAtom), ...payload })
  }
)

/**
 * Tile sizes ranked by duplicate rate, best first — a preselection the user
 * arbitrates, not a verdict: the rate mechanically favours the smaller size.
 */
export const tilesetGridSuggestionsAtom = atom<GridCandidate[]>((get) => {
  const sheet = get(tilesetSheetAtom)
  if (!sheet) return []

  const { tileWidth: _w, tileHeight: _h, ...blanks } = get(tilesetGridAtom)
  return suggestTileGrid({ sheet, blanks })
})
