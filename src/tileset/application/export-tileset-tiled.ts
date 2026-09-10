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
import { type TiledProperty, writeTiledTileset } from '@/libs/pixsaur-tileset'
import type { CPCHardware } from '@/libs/types'
import type {
  ConvertedTileset,
  TilesetConversionSubject
} from './convert-tileset'
import { type EncodeSheetPngResult, encodeSheetPng } from './encode-sheet-png'
import type { Pen } from './pens'
import { renderTileAtlas } from './render-tileset-sheet'

/** The name the workshop gives the archive it hands over. */
export const TILED_ARCHIVE_FILENAME = 'tileset-tiled.zip'

/** Names inside the archive — the TSX refers to the PNG by this path. */
const TILESET_IMAGE = 'tileset.png'
const TILESET_DOCUMENT = 'tileset.tsx'

export type ExportTilesetTiledInput = Pick<
  TilesetConversionSubject,
  'target' | 'mode' | 'hardware'
> & {
  /** The tileset as the workshop shows it — the edit layer laid over. */
  tileset: ConvertedTileset
  /** What a hole was composited over; defaults to black (Q16). */
  background?: Pen
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
  const { tileset, target, mode } = input

  // Every tile, in the order and on the columns of the source sheet: the GID
  // of a tile is then its position in the sheet (M-Q20).
  const atlas = renderTileAtlas(tileset, {
    tiles: tileset.tiles.map((tile) => tile.indices),
    columns: tileset.columns,
    target,
    mode,
    background: input.background
  })
  const encoded = await encodeSheetPng(atlas, canvasFactory)
  if (!encoded.ok) return encoded

  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${mode}` as CpcModeKey]
  const document = writeTiledTileset({
    name: 'tileset',
    tileWidth: target.tileWidth * scaleX,
    tileHeight: target.tileHeight * scaleY,
    tileCount: tileset.tiles.length,
    columns: tileset.columns,
    image: { source: TILESET_IMAGE, width: atlas.width, height: atlas.height },
    properties: cpcProperties(input, { scaleX, scaleY })
  })

  const archive = await zipFiles([
    { name: TILESET_DOCUMENT, content: document },
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
