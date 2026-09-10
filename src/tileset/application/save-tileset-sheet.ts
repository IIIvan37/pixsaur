/**
 * The sheet as a file on the user's disk (Q20).
 *
 * Both effects go through the ports `src/export` already declares, so the
 * use-case stays testable with a fake canvas and a fake sink.
 */

import type { CanvasFactory, FileSink } from '@/export/application/ports'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { type EncodeSheetPngResult, encodeSheetPng } from './encode-sheet-png'

/** The name the workshop gives the sheet it hands over. */
export const TILESET_SHEET_FILENAME = 'tileset.png'

export interface SaveTilesetSheetInput {
  /** The rendered sheet, as `renderTilesetSheet` hands it over. */
  sheet: Sheet
  /** Defaults to {@link TILESET_SHEET_FILENAME}. */
  filename?: string
}

export interface SaveTilesetSheetDeps {
  canvasFactory: CanvasFactory
  fileSink: FileSink
}

export type SaveTilesetSheetResult =
  | { ok: true }
  | Extract<EncodeSheetPngResult, { ok: false }>

export async function saveTilesetSheet(
  { sheet, filename = TILESET_SHEET_FILENAME }: SaveTilesetSheetInput,
  { canvasFactory, fileSink }: SaveTilesetSheetDeps
): Promise<SaveTilesetSheetResult> {
  const encoded = await encodeSheetPng(sheet, canvasFactory)
  if (!encoded.ok) return encoded

  // A cancelled save dialog is not a failure: the user said no, and there is
  // nothing for the caller to do differently.
  await fileSink.save(encoded.png, filename)
  return { ok: true }
}
