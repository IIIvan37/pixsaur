/**
 * Counts the distinct RGBA colours of a sheet.
 *
 * Stops one past `limit`: the caller asks whether an image keeps to a palette,
 * and a filtered capture of a million colours answers that long before the
 * last pixel.
 */

import type { Sheet } from './slice-sheet'

export function countColours(sheet: Sheet, limit: number): number {
  const { data } = sheet
  const seen = new Set<number>()

  for (let at = 0; at < data.length; at += 4) {
    seen.add(
      ((data[at] << 24) | (data[at + 1] << 16) | (data[at + 2] << 8)) +
        data[at + 3]
    )
    if (seen.size > limit) break
  }

  return seen.size
}
