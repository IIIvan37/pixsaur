/**
 * How the source is read — a sheet of tiles or the image of a map — and what
 * the map keeps (M-Q1 · M-Q7). See `docs/features/PLAN-tileset-map.md`.
 */

import { atom, type Getter } from 'jotai'
import {
  cropSheet,
  type OffsetCandidate,
  type Sheet
} from '@/libs/pixsaur-tileset'
import {
  type ConvertedTileset,
  DEFAULT_TILESET_MAP_OPTIONS,
  EMPTY_CELL,
  mapAtlasColumns,
  mapTileset,
  renderTileAtlas,
  suggestMapOffset,
  type TilesetLayout,
  type TilesetMap,
  type TilesetMapOptions
} from '@/tileset'
import { tilesetConversionInputAtom } from './conversion'
import { editedTilesetAtom } from './edits'
import { setTilesetGridAtom, tilesetGridAtom } from './grid'
import { tilesetSheetAtom } from './sheet'

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

/**
 * The offset the map's grid should rather start at, or `null` when it sits on
 * the tiles already — or when the source is a sheet, whose margin and spacing
 * the user declares (M-Q4).
 */
export const tilesetOffsetSuggestionAtom = atom<OffsetCandidate | null>(
  (get) => {
    if (get(tilesetLayoutAtom) !== 'map') return null

    const sheet = get(tilesetSheetAtom)
    return sheet ? suggestMapOffset(sheet, get(tilesetGridAtom)) : null
  }
)

/** The map the workshop shows, or `null` in the sheet layout. */
export const tilesetMapAtom = atom<TilesetMap | null>((get) => {
  if (get(tilesetLayoutAtom) !== 'map') return null

  const result = get(editedTilesetAtom)
  if (!result?.ok) return null

  return mapTileset(result.tileset, get(tilesetMapOptionsAtom))
})

/**
 * Lays tiles of the map out edge to edge, the way the export does. `pick`
 * says which tiles, in which order, on how many columns.
 */
function renderMapTiles(
  get: Getter,
  pick: (
    map: TilesetMap,
    tiles: ConvertedTileset['tiles']
  ) => { tiles: (Uint8Array | null)[]; columns: number }
): Sheet | null {
  const map = get(tilesetMapAtom)
  const result = get(editedTilesetAtom)
  const input = get(tilesetConversionInputAtom)
  if (!map || !result?.ok || !input) return null

  return renderTileAtlas(result.tileset, {
    ...pick(map, result.tileset.tiles),
    target: input.target,
    mode: input.mode,
    background: input.background
  })
}

/**
 * The map rebuilt from its cells (M-Q16) — each cell drawn with the tile the
 * map says it shows, so what the view shows is what the TMX will say.
 */
export const renderedTilesetMapAtom = atom<Sheet | null>((get) =>
  renderMapTiles(get, (map, tiles) => ({
    // An empty cell is drawn as nothing, the way Tiled shows GID 0.
    tiles: map.cells.map((tile) =>
      tile === EMPTY_CELL ? null : tiles[map.tiles[tile]].indices
    ),
    columns: map.columns
  }))
)

/** The distinct tiles of the map, as the Tiled export lays them out. */
export const renderedTilesetAtlasAtom = atom<Sheet | null>((get) =>
  renderMapTiles(get, (map, tiles) => ({
    tiles: map.tiles.map((cell) => tiles[cell].indices),
    columns: mapAtlasColumns(map.tiles.length)
  }))
)

/**
 * The source, cut down to the cells the grid covers — what the view compares
 * the result with, cell for cell (M-Q16).
 */
export const tilesetMapSourceAtom = atom<Sheet | null>((get) => {
  const map = get(tilesetMapAtom)
  const sheet = get(tilesetSheetAtom)
  if (!map || !sheet) return null

  const grid = get(tilesetGridAtom)
  const margin = grid.margin ?? 0
  const spacing = grid.spacing ?? 0
  return cropSheet(sheet, {
    x: margin + (grid.offsetX ?? 0),
    y: margin + (grid.offsetY ?? 0),
    width: map.columns * (grid.tileWidth + spacing) - spacing,
    height: map.rows * (grid.tileHeight + spacing) - spacing
  })
})
