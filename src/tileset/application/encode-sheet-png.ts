/**
 * A rendered sheet as PNG bytes (Q20).
 *
 * The encoding is the browser's: the sheet is drawn on a canvas and handed to
 * `toBlob`. Pixsaur wrote its own PNG encoder for this until the downstream
 * requirement turned out to be truecolor — see `render-tileset-sheet.ts`.
 *
 * Shared by the two exports that carry a PNG: the sheet on its own, and the
 * Tiled archive.
 */

import type { CanvasFactory } from '@/export/application/ports'
import type { Sheet } from '@/libs/pixsaur-tileset'

export type EncodeSheetPngResult =
  | { ok: true; png: Blob }
  | { ok: false; error: 'no-canvas-context' | 'encode-failed' }

export async function encodeSheetPng(
  sheet: Sheet,
  canvasFactory: CanvasFactory
): Promise<EncodeSheetPngResult> {
  const canvas = canvasFactory.createCanvas(sheet.width, sheet.height)
  const context = canvas.getContext('2d')
  if (!context) return { ok: false, error: 'no-canvas-context' }

  context.putImageData(
    new ImageData(sheet.data, sheet.width, sheet.height),
    0,
    0
  )

  const png = await toBlob(canvas)
  if (!png) return { ok: false, error: 'encode-failed' }

  return { ok: true, png }
}

/** `HTMLCanvasElement.toBlob` is callback-shaped; the use-case awaits. */
function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
