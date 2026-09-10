/**
 * The offset to put forward for a map's grid (M-Q4).
 *
 * A suggestion, not a correction: the user keeps the offset fields, and the
 * workshop only speaks up when another offset leaves a smaller share of
 * unique tiles than the one the grid holds. See
 * `docs/features/PLAN-tileset-map.md`.
 */

import {
  type OffsetCandidate,
  rankTileOffsets,
  type Sheet,
  type SheetGrid
} from '@/libs/pixsaur-tileset'

export function suggestMapOffset(
  sheet: Sheet,
  grid: SheetGrid
): OffsetCandidate | null {
  const ranked = rankTileOffsets({ sheet, tile: grid })
  const [best] = ranked
  if (!best) return null

  // An offset past one tile cuts like its remainder, so that is what it is
  // compared as.
  const offsetX = (grid.offsetX ?? 0) % grid.tileWidth
  const offsetY = (grid.offsetY ?? 0) % grid.tileHeight
  const current = ranked.find(
    (candidate) =>
      candidate.offsetX === offsetX && candidate.offsetY === offsetY
  )

  return current && current.uniqueRate <= best.uniqueRate ? null : best
}
