/**
 * Cuts a rectangle out of an RGBA sheet.
 *
 * What the map view compares the result with (M-Q16): the source, reduced to
 * the cells the grid covers, so both images show the same cells in the same
 * box. See `docs/features/PLAN-tileset-map.md`.
 */

import type { Sheet } from './slice-sheet'

export interface SheetRegion {
  x: number
  y: number
  width: number
  height: number
}

/** The region must lie inside the sheet: nothing is clamped. */
export function cropSheet(sheet: Sheet, region: SheetRegion): Sheet {
  const { x, y, width, height } = region
  const data = new Uint8ClampedArray(width * height * 4)

  for (let row = 0; row < height; row++) {
    const start = ((y + row) * sheet.width + x) * 4
    data.set(sheet.data.subarray(start, start + width * 4), row * width * 4)
  }

  return { width, height, data }
}
