/**
 * Guesses whether a tile continues into a copy of itself (Q13).
 *
 * A terrain tile joins onto itself and wants *wrap*; a sprite wants *clamp*.
 * Getting it wrong is the most visible mistake of the lot — visible seams one
 * way, halos the other. See `docs/features/PLAN-tileset-workshop.md`.
 *
 * The test is a comparison, not a threshold: the seam between the last and the
 * first line is measured against the average step the tile already makes
 * inside itself. A tile whose seam is no harsher than its own texture wraps.
 */

import type { SourceTile, TileGrid } from './slice-sheet'
import { columnOffsets, lineDistance, rowOffsets } from './tile-lines'

/** How a tile continues past its own border. */
export type EdgeCondition = 'wrap' | 'clamp'

export interface TileEdges {
  horizontal: EdgeCondition
  vertical: EdgeCondition
}

function edgeAlong(
  tile: SourceTile,
  extent: number,
  lineAt: (index: number) => number[]
): EdgeCondition {
  if (extent < 2) return 'wrap'

  let inside = 0
  for (let i = 1; i < extent; i++) {
    inside += lineDistance(tile, lineAt(i - 1), lineAt(i))
  }
  const seam = lineDistance(tile, lineAt(extent - 1), lineAt(0))

  return seam <= inside / (extent - 1) ? 'wrap' : 'clamp'
}

export function detectTileEdges(tile: SourceTile, grid: TileGrid): TileEdges {
  return {
    horizontal: edgeAlong(tile, grid.tileWidth, (x) => columnOffsets(x, grid)),
    vertical: edgeAlong(tile, grid.tileHeight, (y) => rowOffsets(y, grid))
  }
}
