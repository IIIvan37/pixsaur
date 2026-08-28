/**
 * The flagship resize: choose exactly which source columns and rows survive,
 * so the destination is made of real source pixels rather than averages
 * (Q12). On pixel art, deleting a duplicated column is lossless, where
 * averaging two columns always destroys something.
 *
 * The scheme is **common to the whole tileset** (Q14): dropping column 3 in one
 * tile and column 5 in its neighbour breaks a wall that used to be continuous.
 * Alignment beats per-tile quality, so the search scores a candidate against
 * every tile at once. See `docs/features/PLAN-tileset-workshop.md`.
 *
 * Cost model: each source line is represented by the surviving line nearest to
 * it, and a candidate pays the distance between the two. A duplicated line
 * therefore costs nothing to drop, which is the property the whole approach is
 * built on.
 */

import type { EdgeCondition, TileEdges } from './edge-condition'
import type { SourceTile, TileGrid } from './slice-sheet'
import { columnOffsets, lineDistance, rowOffsets } from './tile-lines'

/**
 * Which source line each destination line takes. One entry per destination
 * pixel, so growing an axis simply repeats an index.
 */
export interface ResizeScheme {
  columns: number[]
  rows: number[]
}

/** Summed distance between every pair of source lines, over all tiles. */
function distanceMatrix(
  tiles: SourceTile[],
  count: number,
  offsetsAt: (index: number) => number[]
): number[][] {
  const lines = Array.from({ length: count }, (_, i) => offsetsAt(i))
  const matrix = Array.from({ length: count }, () => new Array(count).fill(0))

  for (let a = 0; a < count; a++) {
    for (let b = a + 1; b < count; b++) {
      let total = 0
      for (const tile of tiles) total += lineDistance(tile, lines[a], lines[b])
      matrix[a][b] = total
      matrix[b][a] = total
    }
  }

  return matrix
}

/**
 * The surviving line nearest to `index`, which is what concatenating the kept
 * lines puts in its place. A wrapping axis measures that gap around the tile,
 * so a trailing line can be spoken for by the leading one; ties between two
 * equally near survivors go to the cheaper of the two.
 */
function representative(
  index: number,
  kept: number[],
  count: number,
  edge: EdgeCondition,
  costs: number[]
): number {
  let best = kept[0]
  let bestGap = Number.POSITIVE_INFINITY
  for (const line of kept) {
    const straight = Math.abs(index - line)
    const gap =
      edge === 'wrap' ? Math.min(straight, count - straight) : straight
    if (gap < bestGap || (gap === bestGap && costs[line] < costs[best])) {
      best = line
      bestGap = gap
    }
  }
  return best
}

function schemeCost(
  kept: number[],
  matrix: number[][],
  edge: EdgeCondition
): number {
  let total = 0
  for (let index = 0; index < matrix.length; index++) {
    total +=
      matrix[index][
        representative(index, kept, matrix.length, edge, matrix[index])
      ]
  }
  return total
}

/**
 * How many candidate schemes the exhaustive search is allowed to score. An
 * 8-pixel tile is 56 candidates and 16 is a few thousand — both trivial — but
 * a 32-pixel tile halved is 600 million, which is not a search, it is a hang.
 */
const EXHAUSTIVE_BUDGET = 200_000

/** `C(count, keep)`, capped so a huge binomial never overflows into nonsense. */
function candidateCount(count: number, keep: number): number {
  let total = 1
  for (let step = 1; step <= Math.min(keep, count - keep); step++) {
    total = (total * (count - step + 1)) / step
    if (total > EXHAUSTIVE_BUDGET) return Number.POSITIVE_INFINITY
  }
  return total
}

/** Every increasing subset of `keep` indices out of `count`. */
function* keptSets(count: number, keep: number): Generator<number[]> {
  const chosen: number[] = []

  function* walk(start: number): Generator<number[]> {
    if (chosen.length === keep) {
      yield chosen.slice()
      return
    }
    const missing = keep - chosen.length
    for (let index = start; index <= count - missing; index++) {
      chosen.push(index)
      yield* walk(index + 1)
      chosen.pop()
    }
  }

  yield* walk(0)
}

function chooseAxis(
  tiles: SourceTile[],
  count: number,
  keep: number,
  edge: EdgeCondition,
  offsetsAt: (index: number) => number[]
): number[] {
  // Growing an axis is not a choice: there is nothing to select away, only
  // source lines to repeat. Nearest-neighbour invents no pixel.
  if (keep >= count) {
    return Array.from({ length: keep }, (_, index) =>
      Math.floor((index * count) / keep)
    )
  }

  const matrix = distanceMatrix(tiles, count, offsetsAt)
  if (candidateCount(count, keep) > EXHAUSTIVE_BUDGET) {
    return greedyAxis(matrix, keep, edge)
  }

  let best: number[] = []
  let bestCost = Number.POSITIVE_INFINITY
  for (const kept of keptSets(count, keep)) {
    const cost = schemeCost(kept, matrix, edge)
    if (cost < bestCost) {
      best = kept
      bestCost = cost
    }
  }

  return best
}

/**
 * The fallback past the budget: drop lines one at a time, always the one that
 * costs the least right now. It keeps the property the whole approach rests
 * on — a duplicated line is free, so duplicates go first — without paying for
 * a search nobody can wait for.
 */
function greedyAxis(
  matrix: number[][],
  keep: number,
  edge: EdgeCondition
): number[] {
  let kept = Array.from({ length: matrix.length }, (_, index) => index)

  while (kept.length > keep) {
    let best = kept
    let bestCost = Number.POSITIVE_INFINITY
    for (let at = 0; at < kept.length; at++) {
      const candidate = kept.slice(0, at).concat(kept.slice(at + 1))
      const cost = schemeCost(candidate, matrix, edge)
      if (cost < bestCost) {
        best = candidate
        bestCost = cost
      }
    }
    kept = best
  }

  return kept
}

export function chooseResizeScheme(
  tiles: SourceTile[],
  from: TileGrid,
  to: TileGrid,
  edges: TileEdges
): ResizeScheme {
  return {
    columns: chooseAxis(
      tiles,
      from.tileWidth,
      to.tileWidth,
      edges.horizontal,
      (x) => columnOffsets(x, from)
    ),
    rows: chooseAxis(
      tiles,
      from.tileHeight,
      to.tileHeight,
      edges.vertical,
      (y) => rowOffsets(y, from)
    )
  }
}

export function resizeTileByScheme(
  tile: SourceTile,
  from: TileGrid,
  to: TileGrid,
  scheme: ResizeScheme
): SourceTile {
  const data = new Uint8ClampedArray(to.tileWidth * to.tileHeight * 4)

  for (let y = 0; y < to.tileHeight; y++) {
    for (let x = 0; x < to.tileWidth; x++) {
      const source = (scheme.rows[y] * from.tileWidth + scheme.columns[x]) * 4
      data.set(
        tile.data.subarray(source, source + 4),
        (y * to.tileWidth + x) * 4
      )
    }
  }

  return { data }
}
