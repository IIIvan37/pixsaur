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

import type { PixelMode } from '@/domain/cpc'
import type { SheetGrid, SourcePlatform } from '@/libs/pixsaur-tileset'
import type { CPCHardware } from '@/libs/types'
import type {
  ConvertTilesetInput,
  TileSize,
  TilesetSheet
} from './convert-tileset'
import type { TilesetEditLayer } from './paint-tileset'

/** Bump when the stored shape stops reading back. */
export const TILESET_PROJECT_VERSION = 1

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
  | 'ditherByTile'
  | 'ditherSize'
  | 'lockedPens'
  | 'palette'
  | 'paletteStrategy'
  | 'reservedPens'
  | 'resize'
  | 'transparency'
>

export interface TilesetProject {
  version: number
  sheet: TilesetSheet
  /** Where the tiles sit in the source sheet. */
  source: SheetGrid
  /** Tile size in the destination, in CPC pixels. */
  target: TileSize
  mode: PixelMode
  hardware: CPCHardware
  /** The machine the sheet comes from — its pixel shape, nothing else. */
  sourcePlatform: SourcePlatform
  options: TilesetProjectOptions
  edits: TilesetEditLayer
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
  const { sheet, ...rest } = project
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
    isRecord(value.edits) &&
    Array.isArray(value.edits.strokes) &&
    typeof value.edits.at === 'number'
  )
}

/** A sheet whose bytes do not fill its size would slice into other tiles. */
function fillsItsSize(sheet: TilesetSheet): boolean {
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

  if (isRecord(written) && written.version !== TILESET_PROJECT_VERSION) {
    return { ok: false, error: 'unsupported-version' }
  }
  if (!hasProjectShape(written)) return { ok: false, error: 'malformed' }

  const stored = written.sheet as { width: number; height: number }
  if (typeof (written.sheet as { data?: unknown }).data !== 'string') {
    return { ok: false, error: 'malformed' }
  }

  const sheet: TilesetSheet = {
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
 * question — a project of another version is dropped, never migrated blind.
 */
export function readStoredTilesetProject(
  value: unknown
): TilesetProject | null {
  if (!isRecord(value) || value.version !== TILESET_PROJECT_VERSION) return null
  if (!hasProjectShape(value)) return null

  const project = value as unknown as TilesetProject
  if (!(project.sheet.data instanceof Uint8ClampedArray)) return null
  if (!fillsItsSize(project.sheet)) return null

  return project
}
