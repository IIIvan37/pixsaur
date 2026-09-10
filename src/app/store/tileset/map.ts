/**
 * How the source is read — a sheet of tiles or the image of a map — and what
 * the map keeps (M-Q1 · M-Q7). See `docs/features/PLAN-tileset-map.md`.
 */

import { atom } from 'jotai'
import {
  DEFAULT_TILESET_MAP_OPTIONS,
  mapTileset,
  type TilesetLayout,
  type TilesetMap,
  type TilesetMapOptions
} from '@/tileset'
import { editedTilesetAtom } from './edits'
import { setTilesetGridAtom, tilesetGridAtom } from './grid'

export const tilesetLayoutAtom = atom<TilesetLayout>('sheet')

export const tilesetMapOptionsAtom = atom<TilesetMapOptions>(
  DEFAULT_TILESET_MAP_OPTIONS
)

/**
 * A map has no margin and no spacing: the cells of a level touch each other.
 * The grid is only rewritten when it holds one of them, since rewriting it
 * drops the edit layer.
 */
export const setTilesetLayoutAtom = atom(
  null,
  (get, set, layout: TilesetLayout) => {
    if (get(tilesetLayoutAtom) === layout) return
    set(tilesetLayoutAtom, layout)

    const { margin, spacing } = get(tilesetGridAtom)
    if (layout === 'map' && (margin || spacing)) {
      set(setTilesetGridAtom, { margin: 0, spacing: 0 })
    }
  }
)

export const setTilesetMapOptionsAtom = atom(
  null,
  (get, set, payload: Partial<TilesetMapOptions>) => {
    set(tilesetMapOptionsAtom, { ...get(tilesetMapOptionsAtom), ...payload })
  }
)

/** The map the workshop shows, or `null` in the sheet layout. */
export const tilesetMapAtom = atom<TilesetMap | null>((get) => {
  if (get(tilesetLayoutAtom) !== 'map') return null

  const result = get(editedTilesetAtom)
  if (!result?.ok) return null

  return mapTileset(result.tileset, get(tilesetMapOptionsAtom))
})
