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

export interface TilesetMapOptions {
  /** How many tiles the map may keep before the workshop warns (M-Q7). */
  budget: number
}

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
  /** Whether the map keeps more tiles than its budget. */
  overBudget: boolean
}

export function mapTileset(
  tileset: ConvertedTileset,
  options: TilesetMapOptions
): TilesetMap {
  // Deduplicated again rather than read off `instanceOf`: the edit layer is
  // replayed after the conversion, and a stroke can make two tiles identical
  // or tell two copies apart (M-Q18).
  const map = buildTileMap(tileset.tiles.map((tile) => tile.indices))

  return {
    ...map,
    columns: tileset.columns,
    rows: tileset.rows,
    overBudget: map.tiles.length > options.budget
  }
}
