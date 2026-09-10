/**
 * The converted tileset as a Tiled tileset (M-Q10 · M-Q11 · M-Q17 · M-Q20).
 *
 * One archive: a TSX that describes the tiles and the PNG they are cut from.
 * The PNG is an atlas with no gutter, pre-stretched like the sheet, so Tiled
 * shows each tile with the shape it has on a CPC screen. What the user's own
 * toolchain needs to read the pixels back — the mode, the stretch, the pens as
 * the hardware knows them — travels as properties of the tileset.
 *
 * See `docs/features/PLAN-tileset-map.md`.
 */

import { invariant } from '@/core'
import { CPC_MODE_CONFIG, type CpcModeKey, cpcFullPalette } from '@/domain/cpc'
import type { CanvasFactory, FileSink } from '@/export/application/ports'
import { rgbToCPCPlus } from '@/export/exports/cpc-plus-format'
import { zipFiles } from '@/export/exports/zip-files'
import {
  type TiledProperty,
  writeTiledMap,
  writeTiledTileset
} from '@/libs/pixsaur-tileset'
import type { CPCHardware } from '@/libs/types'
import type {
  ConvertedTileset,
  TilesetConversionSubject
} from './convert-tileset'
import { type EncodeSheetPngResult, encodeSheetPng } from './encode-sheet-png'
import type { Pen } from './pens'
import { renderTileAtlas } from './render-tileset-sheet'
import { EMPTY_CELL, mapAtlasColumns, type TilesetMap } from './tileset-map'

/** The name the workshop gives the archive it hands over. */
export const TILED_ARCHIVE_FILENAME = 'tileset-tiled.zip'

/**
 * Names inside the archive — the TMX refers to the TSX, and the TSX to the
 * PNG, by these paths.
 */
const TILESET_IMAGE = 'tileset.png'
const TILESET_DOCUMENT = 'tileset.tsx'
const MAP_DOCUMENT = 'map.tmx'

/** GID 0 is Tiled's cell with no tile (M-Q13); the tileset starts after. */
const NO_TILE_GID = 0
const FIRST_GID = 1

export type ExportTilesetTiledInput = Pick<
  TilesetConversionSubject,
  'target' | 'mode' | 'hardware'
> & {
  /** The tileset as the workshop shows it — the edit layer laid over. */
  tileset: ConvertedTileset
  /** What a hole was composited over; defaults to black (Q16). */
  background?: Pen
  /**
   * The map the tileset was read as, in the map layout (M-Q1). Absent, the
   * source is a sheet and the archive holds no map.
   */
  map?: TilesetMap
  /** Defaults to {@link TILED_ARCHIVE_FILENAME}. */
  filename?: string
}

export interface ExportTilesetTiledDeps {
  canvasFactory: CanvasFactory
  fileSink: FileSink
}

export type ExportTilesetTiledResult =
  | { ok: true }
  | Extract<EncodeSheetPngResult, { ok: false }>

export async function exportTilesetTiled(
  input: ExportTilesetTiledInput,
  { canvasFactory, fileSink }: ExportTilesetTiledDeps
): Promise<ExportTilesetTiledResult> {
  const { tileset, target, mode, map } = input

  // A sheet keeps every tile, in the order and on the columns of the source:
  // the GID of a tile is then its position in the sheet (M-Q20). A map keeps
  // each distinct tile once, in order of first appearance (M-Q12).
  const tiles = map
    ? map.tiles.map((cell) => tileset.tiles[cell].indices)
    : tileset.tiles.map((tile) => tile.indices)
  const columns = map ? mapAtlasColumns(tiles.length) : tileset.columns

  const atlas = renderTileAtlas(tileset, {
    tiles,
    columns,
    target,
    mode,
    background: input.background
  })
  const encoded = await encodeSheetPng(atlas, canvasFactory)
  if (!encoded.ok) return encoded

  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${mode}` as CpcModeKey]
  const tileWidth = target.tileWidth * scaleX
  const tileHeight = target.tileHeight * scaleY
  const tilesetDocument = writeTiledTileset({
    name: 'tileset',
    tileWidth,
    tileHeight,
    tileCount: tiles.length,
    columns,
    image: { source: TILESET_IMAGE, width: atlas.width, height: atlas.height },
    properties: cpcProperties(input, { scaleX, scaleY })
  })

  const archive = await zipFiles([
    ...(map
      ? [
          {
            name: MAP_DOCUMENT,
            content: writeTiledMap({
              width: map.columns,
              height: map.rows,
              tileWidth,
              tileHeight,
              tileset: { firstGid: FIRST_GID, source: TILESET_DOCUMENT },
              layer: {
                name: 'map',
                gids: map.cells.map((tile) =>
                  tile === EMPTY_CELL ? NO_TILE_GID : tile + FIRST_GID
                )
              }
            })
          }
        ]
      : []),
    { name: TILESET_DOCUMENT, content: tilesetDocument },
    { name: TILESET_IMAGE, content: encoded.png }
  ])

  // A cancelled save dialog is not a failure: the user said no.
  await fileSink.save(archive, input.filename ?? TILED_ARCHIVE_FILENAME)
  return { ok: true }
}

/** What a CPC toolchain needs to read the atlas back (M-Q11). */
function cpcProperties(
  { tileset, mode, hardware }: ExportTilesetTiledInput,
  { scaleX, scaleY }: { scaleX: number; scaleY: number }
): TiledProperty[] {
  return [
    { name: 'cpcMode', type: 'int', value: mode },
    { name: 'hardware', type: 'string', value: hardware },
    { name: 'scaleX', type: 'int', value: scaleX },
    { name: 'scaleY', type: 'int', value: scaleY },
    {
      name: 'palette',
      type: 'string',
      value: tileset.palette.map((pen) => hardwareWord(pen, hardware)).join()
    },
    {
      name: 'paletteRgb',
      type: 'string',
      value: tileset.palette.map(rgbHex).join()
    }
  ]
}

/**
 * A pen as the hardware is told it: the firmware ink number on a classic CPC,
 * the 12-bit ASIC word on a Plus — green, then red, then blue.
 */
function hardwareWord(pen: Pen, hardware: CPCHardware): string {
  if (hardware === 'plus') {
    const [red, green, blue] = pen
    return rgbToCPCPlus(red, green, blue)
      .toString(16)
      .toUpperCase()
      .padStart(3, '0')
  }

  const ink = cpcFullPalette.find(({ vector }) =>
    vector.every((channel, at) => channel === pen[at])
  )
  // Every pen comes out of the hardware palette (Q26), so the lookup holds.
  invariant(ink !== undefined, 'pen is off the classic hardware palette')
  return String(ink.index)
}

function rgbHex(pen: Pen): string {
  return `#${pen
    .slice(0, 3)
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}
