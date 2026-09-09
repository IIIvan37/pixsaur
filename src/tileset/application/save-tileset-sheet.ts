/**
 * The sheet as a file on the user's disk (Q20).
 *
 * The encoding is the browser's: the sheet is drawn on a canvas and handed to
 * `toBlob`. Pixsaur wrote its own PNG encoder for this until the downstream
 * requirement turned out to be truecolor — see `render-tileset-sheet.ts`.
 *
 * Both effects go through the ports `src/export` already declares, so the
 * use-case stays testable with a fake canvas and a fake sink.
 */

import type { CanvasFactory, FileSink } from '@/export/application/ports'
import type { TilesetSheet } from './convert-tileset'

/** The name the workshop gives the sheet it hands over. */
export const TILESET_SHEET_FILENAME = 'tileset.png'

export interface SaveTilesetSheetInput {
  /** The rendered sheet, as `renderTilesetSheet` hands it over. */
  sheet: TilesetSheet
  /** Defaults to {@link TILESET_SHEET_FILENAME}. */
  filename?: string
}

export interface SaveTilesetSheetDeps {
  canvasFactory: CanvasFactory
  fileSink: FileSink
}

export type SaveTilesetSheetResult =
  | { ok: true }
  | { ok: false; error: 'no-canvas-context' | 'encode-failed' }

export async function saveTilesetSheet(
  { sheet, filename = TILESET_SHEET_FILENAME }: SaveTilesetSheetInput,
  { canvasFactory, fileSink }: SaveTilesetSheetDeps
): Promise<SaveTilesetSheetResult> {
  const canvas = canvasFactory.createCanvas(sheet.width, sheet.height)
  const context = canvas.getContext('2d')
  if (!context) return { ok: false, error: 'no-canvas-context' }

  context.putImageData(
    new ImageData(sheet.data, sheet.width, sheet.height),
    0,
    0
  )

  const blob = await toBlob(canvas)
  if (!blob) return { ok: false, error: 'encode-failed' }

  // A cancelled save dialog is not a failure: the user said no, and there is
  // nothing for the caller to do differently.
  await fileSink.save(blob, filename)
  return { ok: true }
}

/** `HTMLCanvasElement.toBlob` is callback-shaped; the use-case awaits. */
function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
