/**
 * The converted tileset read as a map (M-Q1 · M-Q7 · M-Q18).
 *
 * A map is a sheet whose grid of references the workshop keeps: the image of
 * a level cut into cells, each cell showing one of the distinct tiles. The
 * layout decides what the export writes, not how the tiles are converted.
 * See `docs/features/PLAN-tileset-map.md`.
 */

import { perceptualDistance } from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  buildTileMap,
  mergeNearTiles,
  type TileBytes,
  type TileMap
} from '@/libs/pixsaur-tileset'
import type { ConvertedTileset } from './convert-tileset'
import type { Pen } from './pens'

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
  /**
   * Largest gap two tiles may have and still be merged (M-Q14 · M-Q15): the
   * perceptual distance between the pens of every pixel that differs, summed.
   * Absent or 0 merges nothing.
   */
  mergeThreshold?: number
  /**
   * Merges the user refused, as the cells the two tiles first appear in —
   * positions, which outlive a conversion where tile indices do not (M-Q18).
   */
  mergeExclusions?: ReadonlyArray<readonly [number, number]>
}

/** One merge the map made, named by the cells its two tiles first appear in. */
export interface TilesetMerge {
  absorbed: number
  survivor: number
  distance: number
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
  merges: TilesetMerge[]
}

/**
 * How far apart two tiles of the palette are: the perceptual distance of every
 * pixel whose pen differs, summed (M-Q14). Two neighbouring greens weigh less
 * than a black pixel in a yellow field. The pen-to-pen table is built once.
 */
function tileDistance(palette: readonly Pen[]) {
  const pens = palette.length
  const gaps = new Float64Array(pens * pens)
  for (let a = 0; a < pens; a++) {
    for (let b = 0; b < pens; b++) {
      gaps[a * pens + b] = perceptualDistance(
        palette[a] as Vector,
        palette[b] as Vector
      )
    }
  }

  return (a: TileBytes, b: TileBytes): number => {
    let sum = 0
    for (let pixel = 0; pixel < a.length; pixel++) {
      if (a[pixel] !== b[pixel]) sum += gaps[a[pixel] * pens + b[pixel]]
    }
    return sum
  }
}

/**
 * The merges of M-Q15, applied last (M-Q18): no pixel changes, the cells of
 * an absorbed tile point at the tile that stays, and the tiles close up.
 */
function mergeTiles(
  tileset: ConvertedTileset,
  map: TileMap,
  options: TilesetMapOptions
): TileMap & { merges: TilesetMerge[] } {
  const threshold = options.mergeThreshold ?? 0
  if (threshold <= 0) return { ...map, merges: [] }

  const frequencies = new Array<number>(map.tiles.length).fill(0)
  for (const tile of map.cells) if (tile !== EMPTY_CELL) frequencies[tile]++

  const indexOf = new Map(map.tiles.map((cell, index) => [cell, index]))
  const excluded = (options.mergeExclusions ?? []).flatMap(([a, b]) => {
    const first = indexOf.get(a)
    const second = indexOf.get(b)
    return first === undefined || second === undefined
      ? []
      : [[first, second] as const]
  })

  const found = mergeNearTiles({
    tiles: map.tiles.map((cell) => tileset.tiles[cell].indices),
    frequencies,
    distance: tileDistance(tileset.palette),
    threshold,
    excluded
  })

  // A tile that stays was never absorbed, so it points at itself.
  const target = map.tiles.map((_, index) => index)
  for (const { absorbed, survivor } of found) target[absorbed] = survivor
  const kept = target.flatMap((to, index) => (to === index ? [index] : []))
  const renumbered = new Map(kept.map((index, at) => [index, at]))

  return {
    cells: map.cells.map((tile) =>
      tile === EMPTY_CELL
        ? EMPTY_CELL
        : (renumbered.get(target[tile]) as number)
    ),
    tiles: kept.map((index) => map.tiles[index]),
    merges: found.map(({ absorbed, survivor, distance }) => ({
      absorbed: map.tiles[absorbed],
      survivor: map.tiles[survivor],
      distance
    }))
  }
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

  // The empty tile goes first, so no tile is ever merged into it.
  const shown: TileMap =
    empty === null
      ? map
      : {
          cells: withoutTile(map.cells, empty),
          tiles: map.tiles.filter((_, tile) => tile !== empty)
        }
  const { cells, tiles, merges } = mergeTiles(tileset, shown, options)

  return {
    cells,
    tiles,
    merges,
    emptyTile: empty === null ? null : map.tiles[empty],
    columns: tileset.columns,
    rows: tileset.rows,
    overBudget: tiles.length > options.budget
  }
}
