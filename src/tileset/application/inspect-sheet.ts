/**
 * What the workshop checks in a source before cutting it (M-Q19).
 *
 * Two things make an exact extraction fail, and both show before any cut: a
 * capture blown up by a whole factor, which the workshop can undo, and a
 * filtered one, which it cannot. See `docs/features/PLAN-tileset-map.md`.
 */

import {
  countColours,
  detectIntegerScale,
  type IntegerScale,
  type Sheet
} from '@/libs/pixsaur-tileset'

/**
 * Past this many colours, an image is no longer read as pixel art. A NES
 * shows 54 colours at most, and a SNES screen rarely comes near this; a
 * bilinear or CRT filter blends every edge into new colours and passes it
 * at once. A threshold, so a verdict worded as a doubt, never as a refusal.
 */
export const FILTERED_COLOURS = 512

export interface SheetInspection {
  /** The whole factor to undo, or `null` when the image is at its own size. */
  scale: IntegerScale | null
  /** Whether the image carries more colours than pixel art does. */
  filtered: boolean
}

export function inspectSheet(sheet: Sheet): SheetInspection {
  const colours = countColours(sheet, FILTERED_COLOURS)
  const filtered = colours > FILTERED_COLOURS

  // One colour is uniform at every scale, and a filtered image has no block
  // left whole: neither has a factor worth looking for.
  const scale = colours > 1 && !filtered ? detectIntegerScale(sheet) : null

  return { scale: scale && scale.factor > 1 ? scale : null, filtered }
}
