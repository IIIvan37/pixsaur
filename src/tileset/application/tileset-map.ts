/**
 * The converted tileset read as a map (M-Q1 · M-Q7 · M-Q18).
 *
 * A map is a sheet whose grid of references the workshop keeps: the image of
 * a level cut into cells, each cell showing one of the distinct tiles. The
 * layout decides what the export writes, not how the tiles are converted.
 * See `docs/features/PLAN-tileset-map.md`.
 */

import { buildTileMap, type TileMap } from '@/libs/pixsaur-tileset'
import type { ConvertedTileset } from './convert-tileset'

/** How the source is read: a sheet of tiles, or the image of a map (M-Q1). */
export type TilesetLayout = 'sheet' | 'map'

/**
 * Which tile becomes Tiled's GID 0, a cell with no tile (M-Q13): `auto` — the
 * tile made of holes only, if the map has one; a cell position — the tile
 * that cell shows; `null` — none.
 */
export type EmptyTileChoice = 'auto' | number | null

export interface TilesetMapOptions {
  /** How many tiles the map may keep before the workshop warns (M-Q7). */
  budget: number
  /** Absent reads as `auto`, so a project saved before M-Q13 needs nothing. */
  emptyTile?: EmptyTileChoice
}

/** What an empty cell holds in `cells`, in place of a tile index. */
export const EMPTY_CELL = -1

/** 256 — what a map whose cells are one byte each can index. */
export const DEFAULT_TILESET_MAP_OPTIONS: TilesetMapOptions = { budget: 256 }

/** How wide the atlas of a map is, in tiles (M-Q12). */
const ATLAS_COLUMNS = 16

/**
 * The column count of the atlas a map's tiles are laid out on: 16, or fewer
 * when the map keeps fewer tiles — never zero, which no image can be cut on.
 */
export function mapAtlasColumns(tileCount: number): number {
  return Math.max(1, Math.min(ATLAS_COLUMNS, tileCount))
}

export interface TilesetMap extends TileMap {
  /** Size of the map, in cells — the source grid. */
  columns: number
  rows: number
  /**
   * Whether the map keeps more tiles than its budget. The empty tile is not
   * one of them: it is written nowhere.
   */
  overBudget: boolean
  /** The cell the empty tile first appears in, or `null` when none is. */
  emptyTile: number | null
}

/** Index in `map.tiles` of the tile to empty, or `null`. */
function emptyTileOf(
  tileset: ConvertedTileset,
  map: TileMap,
  choice: EmptyTileChoice
): number | null {
  if (choice === null) return null

  if (choice === 'auto') {
    const hole = tileset.transparentPen
    if (hole === null) return null
    const found = map.tiles.findIndex((cell) =>
      tileset.tiles[cell].indices.every((pen) => pen === hole)
    )
    return found >= 0 ? found : null
  }

  return map.cells[choice] ?? null
}

/** The cells once the empty tile is taken out and the rest closes the gap. */
function withoutTile(cells: readonly number[], empty: number): number[] {
  return cells.map((tile) => {
    if (tile === empty) return EMPTY_CELL
    return tile > empty ? tile - 1 : tile
  })
}

export function mapTileset(
  tileset: ConvertedTileset,
  options: TilesetMapOptions
): TilesetMap {
  // Deduplicated again rather than read off `instanceOf`: the edit layer is
  // replayed after the conversion, and a stroke can make two tiles identical
  // or tell two copies apart (M-Q18).
  const map = buildTileMap(tileset.tiles.map((tile) => tile.indices))
  const empty = emptyTileOf(tileset, map, options.emptyTile ?? 'auto')

  const tiles =
    empty === null ? map.tiles : map.tiles.filter((_, tile) => tile !== empty)

  return {
    cells: empty === null ? map.cells : withoutTile(map.cells, empty),
    tiles,
    emptyTile: empty === null ? null : map.tiles[empty],
    columns: tileset.columns,
    rows: tileset.rows,
    overBudget: tiles.length > options.budget
  }
}
