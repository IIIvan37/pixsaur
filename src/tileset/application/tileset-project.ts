/**
 * The workshop's document, as it survives a reload or a hand-off (Q31).
 *
 * A project holds everything the conversion cannot recompute: the source
 * sheet, how it is cut, what it is converted to, and the edit layer painted
 * over it. Two carriers, one shape — IndexedDB keeps the object as it stands
 * (a structured clone carries the sheet bytes), the project file carries the
 * same fields as JSON with the bytes in base64.
 *
 * The session mechanism of the image workshop does not serve here: its
 * anti-quota fallback drops the image, and dropping the sheet would leave a
 * project that cannot be converted at all.
 */

import type { Sheet, SourcePlatform } from '@/libs/pixsaur-tileset'
import type {
  ConvertTilesetInput,
  TilesetConversionSubject
} from './convert-tileset'
import type { TilesetEditLayer } from './paint-tileset'
import {
  DEFAULT_TILESET_MAP_OPTIONS,
  type TilesetLayout,
  type TilesetMapOptions
} from './tileset-map'

/**
 * Bump when the stored shape stops reading back.
 *
 * 2 — `lockedPens` became a map of position to colour: a pin now carries the
 * index it holds, and a v1 file's array would be read as a map keyed 0, 1, 2…
 *
 * 3 — the layout and the map options (M-Q21). A version 2 project still reads:
 * it was a sheet, with no map to speak of.
 *
 * 4 — the edit layer became a table of the pens painted over each position
 * (S-Q6), and the per-tile dithering left (S-Q3). A version 3 project still
 * reads: its strokes are laid down up to the undo cursor, the last one winning.
 */
export const TILESET_PROJECT_VERSION = 4

/**
 * What a migration has to tell the user, once: a version 3 project that
 * dithered some tiles apart now renders them as the rest of the sheet.
 */
export type TilesetProjectNotice = 'tile-dither-dropped'

/**
 * What the conversion is asked to do, beyond the sheet and the two grids.
 * Typed off `ConvertTilesetInput` so the panels, the use-case and the file
 * cannot drift apart.
 */
export type TilesetProjectOptions = Pick<
  ConvertTilesetInput,
  | 'antiAlias'
  | 'background'
  | 'dither'
  | 'ditherSize'
  | 'lockedPens'
  | 'palette'
  | 'paletteStrategy'
  | 'reservedPens'
  | 'resize'
  | 'transparency'
>

export interface TilesetProject extends TilesetConversionSubject {
  version: number
  /** The machine the sheet comes from — its pixel shape, nothing else. */
  sourcePlatform: SourcePlatform
  options: TilesetProjectOptions
  edits: TilesetEditLayer
  layout: TilesetLayout
  map: TilesetMapOptions
  /**
   * The name of the file the sheet came from, shown in the workshop bar.
   * Optional: a project written before it, or from a sheet nothing named,
   * reads without one.
   */
  sheetName?: string
  /**
   * Set by the migration that read the project, never written back: the next
   * save is a version 4 project with nothing left to say (S-Q7).
   */
  notice?: TilesetProjectNotice
}

/**
 * Version 2 to 3. Every field version 2 lacks has one reading only — a
 * version 2 project was a sheet — so the step guesses nothing.
 */
function fromVersion2(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    version: 3,
    layout: 'sheet',
    map: DEFAULT_TILESET_MAP_OPTIONS
  }
}

/**
 * The strokes of version 3 laid down as the table of version 4: up to the
 * undo cursor, in order, the last stroke winning on a pixel. `null` when they
 * do not read, which leaves the project to be refused as malformed.
 */
function layerFromStrokes(
  edits: unknown,
  target: unknown
): TilesetEditLayer | null {
  if (!isRecord(edits) || !Array.isArray(edits.strokes)) return null
  if (typeof edits.at !== 'number' || !isSize(target)) return null

  const width = (target as { tileWidth: number }).tileWidth
  const layer: Record<number, Record<number, number>> = {}
  for (const stroke of edits.strokes.slice(0, edits.at + 1)) {
    if (!isRecord(stroke) || !Array.isArray(stroke.tiles)) return null
    if (!Array.isArray(stroke.edits)) return null
    for (const tile of stroke.tiles) {
      for (const edit of stroke.edits) {
        if (typeof tile !== 'number' || !isPixelEdit(edit)) return null
        layer[tile] = {
          ...layer[tile],
          [edit.y * width + edit.x]: edit.newInkIndex
        }
      }
    }
  }
  return layer
}

function isPixelEdit(
  value: unknown
): value is { x: number; y: number; newInkIndex: number } {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.newInkIndex === 'number'
  )
}

/**
 * Version 3 to 4: the strokes become the table, and the per-tile dithering
 * goes. A project that held some says so, since its tiles now render as the
 * rest of the sheet.
 */
function fromVersion3(value: Record<string, unknown>): Record<string, unknown> {
  const { ditherByTile, ...options } = isRecord(value.options)
    ? value.options
    : { ditherByTile: undefined }
  const dithered =
    isRecord(ditherByTile) && Object.keys(ditherByTile).length > 0

  return {
    ...value,
    version: 4,
    edits: layerFromStrokes(value.edits, value.target),
    options: isRecord(value.options) ? options : value.options,
    ...(dithered ? { notice: 'tile-dither-dropped' } : {})
  }
}

/** One step per older version still read, chained up to the current one. */
const STEPS: Record<
  number,
  (value: Record<string, unknown>) => Record<string, unknown>
> = {
  2: fromVersion2,
  3: fromVersion3
}

/**
 * Brings an older project up to the current shape, one version at a time.
 * Any version without a step passes through untouched, to be refused.
 */
function migrate(value: Record<string, unknown>): Record<string, unknown> {
  let current = value
  while (typeof current.version === 'number' && STEPS[current.version]) {
    current = STEPS[current.version](current)
  }
  return current
}

export type ParseTilesetProjectResult =
  | { ok: true; project: TilesetProject }
  | { ok: false; error: 'invalid-json' | 'unsupported-version' | 'malformed' }

/** Chunked: one `fromCharCode` over a whole sheet overflows the call stack. */
const CHUNK = 0x8000

function toBase64(data: Uint8ClampedArray): string {
  let binary = ''
  for (let at = 0; at < data.length; at += CHUNK) {
    binary += String.fromCharCode(...data.subarray(at, at + CHUNK))
  }
  return btoa(binary)
}

function fromBase64(text: string): Uint8ClampedArray {
  const binary = atob(text)
  const data = new Uint8ClampedArray(binary.length)
  for (let at = 0; at < binary.length; at++) data[at] = binary.charCodeAt(at)
  return data
}

/** Serialize a project as the JSON file the user exports and re-imports. */
export function serializeTilesetProject(project: TilesetProject): string {
  const { sheet, notice: _notice, ...rest } = project
  return JSON.stringify({
    ...rest,
    version: TILESET_PROJECT_VERSION,
    sheet: {
      width: sheet.width,
      height: sheet.height,
      data: toBase64(sheet.data)
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSize(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.tileWidth === 'number' &&
    typeof value.tileHeight === 'number'
  )
}

/** For each position, pens keyed by pixel — what `TilesetEditLayer` holds. */
function isEditLayer(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (pens) =>
        isRecord(pens) &&
        Object.values(pens).every((pen) => typeof pen === 'number')
    )
  )
}

/** The fields both carriers share — everything but how the bytes travel. */
function hasProjectShape(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    isRecord(value.sheet) &&
    typeof value.sheet.width === 'number' &&
    typeof value.sheet.height === 'number' &&
    isSize(value.source) &&
    isSize(value.target) &&
    typeof value.mode === 'number' &&
    typeof value.hardware === 'string' &&
    typeof value.sourcePlatform === 'string' &&
    isRecord(value.options) &&
    isEditLayer(value.edits) &&
    (value.layout === 'sheet' || value.layout === 'map') &&
    isRecord(value.map) &&
    typeof value.map.budget === 'number'
  )
}

/** A sheet whose bytes do not fill its size would slice into other tiles. */
function fillsItsSize(sheet: Sheet): boolean {
  return sheet.data.length === sheet.width * sheet.height * 4
}

/** Read back a project file. Every failure names what the user can act on. */
export function parseTilesetProject(text: string): ParseTilesetProjectResult {
  let written: unknown
  try {
    written = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalid-json' }
  }
  if (isRecord(written)) written = migrate(written)

  if (isRecord(written) && written.version !== TILESET_PROJECT_VERSION) {
    return { ok: false, error: 'unsupported-version' }
  }
  if (!hasProjectShape(written)) return { ok: false, error: 'malformed' }

  const stored = written.sheet as { width: number; height: number }
  if (typeof (written.sheet as { data?: unknown }).data !== 'string') {
    return { ok: false, error: 'malformed' }
  }

  const sheet: Sheet = {
    width: stored.width,
    height: stored.height,
    data: fromBase64((written.sheet as { data: string }).data)
  }
  if (!fillsItsSize(sheet)) return { ok: false, error: 'malformed' }

  return {
    ok: true,
    project: { ...(written as unknown as TilesetProject), sheet }
  }
}

/**
 * Read back what the browser store handed over. The bytes came through the
 * structured clone as they were, so only the shape and the version are in
 * question. A version 2 or 3 project is migrated; one of any other version is
 * dropped, never migrated blind.
 */
export function readStoredTilesetProject(
  stored: unknown
): TilesetProject | null {
  if (!isRecord(stored)) return null
  const value = migrate(stored)
  if (value.version !== TILESET_PROJECT_VERSION) return null
  if (!hasProjectShape(value)) return null

  const project = value as unknown as TilesetProject
  if (!(project.sheet.data instanceof Uint8ClampedArray)) return null
  if (!fillsItsSize(project.sheet)) return null

  return project
}
