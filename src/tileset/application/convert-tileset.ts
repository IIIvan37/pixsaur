/**
 * Converts a tileset sheet from another machine to CPC constraints.
 *
 * Pure, synchronous, total — no ports. The caller owns the side effects
 * (reading the source file, saving the produced PNG); this use-case only
 * computes. See `docs/features/PLAN-tileset-workshop.md`.
 */

import { invariant } from '@/core'
import {
  CPC_MODE_CONFIG,
  type CpcModeKey,
  colorToKey,
  getPaletteForHardware,
  type PixelMode,
  perceptualDistance,
  quantizeColorForHardware
} from '@/domain/cpc'
import {
  applyPaletteStrategyV2,
  type ColorCandidate
} from '@/libs/pixsaur-color/src/quant/palette-strategies-v2'
import type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { encodeIndexedPng } from '@/libs/pixsaur-png'
import {
  chooseResizeScheme,
  dedupeTiles,
  detectTileEdges,
  type EdgeCondition,
  rankTileCollisions,
  resizeTileByScheme,
  resizeTileNearest,
  type SheetGrid,
  type SourceTile,
  sliceSheet,
  type TileCollision,
  type TileEdges,
  tilePaletteHistogram
} from '@/libs/pixsaur-tileset'
import type { CPCHardware } from '@/libs/types'

/** An RGBA sheet: `data` is `width * height * 4` bytes. */
export interface TilesetSheet {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** Tile dimensions, in pixels of the space they belong to. */
export interface TileSize {
  tileWidth: number
  tileHeight: number
}

export interface ConvertTilesetInput {
  sheet: TilesetSheet
  /** Where the tiles sit in the source sheet: size, margin, spacing, offset. */
  source: SheetGrid
  /** Tile size in the destination, in CPC pixels. */
  target: TileSize
  mode: PixelMode
  hardware: CPCHardware
  /**
   * How pixels are dropped when the tile shrinks. `columns` is the flagship
   * search of Q12; `nearest` is the phase-locked baseline it is compared
   * against. Defaults to `columns`.
   */
  resize?: 'columns' | 'nearest'
  /**
   * Which of the 12 palette strategies picks the shared pens (Q15). Defaults to
   * `exhaustive-contrast`, the same default the image workshop carries.
   */
  paletteStrategy?: PaletteStrategy
  /**
   * Pens to keep out of the quantization, so the sprites can have them (Q23).
   * Reserved by COUNT, not by colour — which is what makes it a mode 0
   * feature: mode 1 has 4 pens, mode 2 has 2, and neither can spare any.
   */
  reservedPens?: number
  /**
   * The colour a transparent pixel is composited over before quantization
   * (Q16). Defaults to black.
   */
  background?: Pen
  /**
   * What becomes of an alpha channel (Q16). `pen` spends one of the mode's
   * pens on a hole, `flatten` composites over `background`. Defaults to `pen`
   * in mode 0 and `flatten` in modes 1 and 2, where no pen can be spared.
   */
  transparency?: 'pen' | 'flatten'
}

/** One converted tile: palette indices, `target.tileWidth * tileHeight` long. */
export interface ConvertedTile {
  indices: Uint8Array
}

/** An RGB pen, already snapped to a CPC hardware colour. */
export type Pen = [r: number, g: number, b: number]

const BLACK: Pen = [0, 0, 0]

/** A hole always takes the first pen — the one CPC sprite routines test. */
const TRANSPARENT_PEN = 0

/**
 * Marks a pixel as a hole while it travels as a base-palette index. Safely out
 * of range: the widest base palette, CPC Plus, stops at 4095.
 */
const HOLE = 0xffff

/** Below this, a pixel is a hole rather than a colour to composite. */
const OPACITY_THRESHOLD = 128

function spendsPenOnHoles(input: ConvertTilesetInput): boolean {
  return (
    (input.transparency ?? (input.mode === 0 ? 'pen' : 'flatten')) === 'pen'
  )
}

export interface ConvertedTileset {
  columns: number
  rows: number
  /** Shared by every tile — the CPC has one palette at a time. */
  palette: Pen[]
  tiles: ConvertedTile[]
  /** For each tile, the tile it is an instance of — the edit link of Q11. */
  instanceOf: number[]
  /** Positions of the distinct tiles, in order of first appearance. */
  unique: number[]
  /** The pen standing for a hole, or `null` when alpha was flattened (Q16). */
  transparentPen: number | null
  /**
   * The tiles the source held apart, worst first, by how far the shared palette
   * pushed them from the colours they asked for (Q22). What the manual
   * retouching reads.
   */
  collisions: TileCollision[]
}

export type ConvertTilesetResult =
  | { ok: true; tileset: ConvertedTileset; png: Uint8Array }
  | { ok: false; error: 'grid-mismatch' | 'no-pens-left' }

export function convertTileset(
  input: ConvertTilesetInput
): ConvertTilesetResult {
  const maxPens = penBudget(input)
  if (maxPens < 1) return { ok: false, error: 'no-pens-left' }

  const sliced = sliceSheet(input.sheet, input.source)
  if (!sliced) return { ok: false, error: 'grid-mismatch' }

  const { columns, rows, tiles } = sliced
  const scheme =
    input.resize === 'nearest'
      ? null
      : chooseResizeScheme(
          tiles,
          input.source,
          input.target,
          sheetEdges(tiles, input.source)
        )

  // Every pixel first lands on a hardware colour; the palette is then chosen
  // among those, not among the source's own colours (Q26 — after resize).
  const basePalette = getPaletteForHardware(input.hardware)
  const baseIndexByKey = new Map(
    basePalette.map((colour, index) => [colorToKey(colour), index])
  )
  const background = input.background ?? BLACK
  const holePen = spendsPenOnHoles(input) ? TRANSPARENT_PEN : null
  const snapped = tiles.map((tile) => {
    const resized = scheme
      ? resizeTileByScheme(tile, input.source, input.target, scheme)
      : resizeTileNearest(tile, input.source, input.target)
    return snapToHardware(resized.data, baseIndexByKey, input.hardware, {
      background,
      marksHoles: holePen !== null
    })
  })

  const chosen = selectPalette(
    snapped,
    basePalette,
    holePen === null ? maxPens : maxPens - 1,
    input
  )
  // The transparency pen comes first and is never a quantization target: only
  // alpha can reach it, so an opaque pixel of the same colour stays distinct.
  const palette = holePen === null ? chosen : [background, ...chosen]
  const penOf = nearestPens(chosen, basePalette, holePen === null ? 0 : 1)
  const errorOf = penDistances(
    chosen,
    basePalette,
    penOf,
    holePen === null ? 0 : 1
  )
  const converted: ConvertedTile[] = snapped.map((tile) => {
    const indices = new Uint8Array(tile.length)
    for (let pixel = 0; pixel < tile.length; pixel++) {
      indices[pixel] =
        tile[pixel] === HOLE ? TRANSPARENT_PEN : penOf[tile[pixel]]
    }
    return { indices }
  })

  // Deduplicating the CONVERTED tiles, not the source ones: two source tiles
  // that only differed below the CPC palette's resolution have become the same
  // tile, and editing one must reach the other (Q11).
  const { instanceOf, unique } = dedupeTiles(converted.map((t) => t.indices))

  const tileset: ConvertedTileset = {
    columns,
    rows,
    palette,
    tiles: converted,
    instanceOf,
    unique,
    transparentPen: holePen,
    collisions: rankTileCollisions(
      snapped,
      // Deduplicated BEFORE the palette, not after: two source tiles that the
      // shared palette collapsed into one are exactly the collision the report
      // exists to surface, and the converted `unique` no longer holds both.
      dedupeTiles(snapped).unique,
      errorOf,
      { ignore: HOLE }
    )
  }

  return { ok: true, tileset, png: renderPng(tileset, input) }
}

/**
 * One edge condition per axis for the whole sheet, decided by majority (Q13).
 * The removal scheme is shared by every tile (Q14), so it can only be scored
 * under a single edge condition — a sheet that is mostly terrain is treated as
 * terrain. Per-tile edges would need a per-tile cost attribution; see the plan.
 */
function sheetEdges(tiles: SourceTile[], grid: SheetGrid): TileEdges {
  const verdicts = tiles.map((tile) => detectTileEdges(tile, grid))
  const majority = (axis: keyof TileEdges): EdgeCondition =>
    verdicts.filter((edge) => edge[axis] === 'wrap').length * 2 >=
    verdicts.length
      ? 'wrap'
      : 'clamp'

  return { horizontal: majority('horizontal'), vertical: majority('vertical') }
}

/** Base-palette index of every pixel, once snapped to the hardware. */
type SnappedTile = Uint16Array

/**
 * Snaps each pixel to the hardware colour space and reports its position in the
 * base palette. The snap is componentwise, so the result always exists there —
 * 27 colours on classic, 4096 on Plus.
 */
function snapToHardware(
  data: Uint8ClampedArray,
  indexByKey: ReadonlyMap<string, number>,
  hardware: CPCHardware,
  alpha: { background: Pen; marksHoles: boolean }
): SnappedTile {
  const snapped = new Uint16Array(data.length / 4)

  for (let pixel = 0; pixel < snapped.length; pixel++) {
    const at = pixel * 4
    if (alpha.marksHoles && data[at + 3] < OPACITY_THRESHOLD) {
      snapped[pixel] = HOLE
      continue
    }

    const opacity = data[at + 3] / 255
    const flattened = alpha.background.map(
      (behind, channel) => data[at + channel] * opacity + behind * (1 - opacity)
    ) as Vector
    const key = colorToKey(quantizeColorForHardware(flattened, hardware))
    const index = indexByKey.get(key)
    invariant(
      index !== undefined,
      `snapped colour ${key} is off the hardware palette`
    )
    snapped[pixel] = index
  }

  return snapped
}

/**
 * Picks the pens the whole tileset shares, from a histogram weighted one unit
 * per UNIQUE tile (Q3 · Q15) and handed to one of the 12 strategies (Q15).
 */
function penBudget(input: ConvertTilesetInput): number {
  return (
    CPC_MODE_CONFIG[`${input.mode}` as CpcModeKey].nColors -
    (input.reservedPens ?? 0)
  )
}

function selectPalette(
  snapped: readonly SnappedTile[],
  basePalette: Vector[],
  maxPens: number,
  input: ConvertTilesetInput
): Pen[] {
  const candidates: ColorCandidate[] = tilePaletteHistogram(snapped, {
    ignore: HOLE
  }).map(({ index, frequency }) => ({
    index,
    frequency,
    color: [...basePalette[index]] as Vector,
    converted: [...basePalette[index]] as Vector
  }))

  const { selectedIndices } = applyPaletteStrategyV2(
    input.paletteStrategy ?? 'exhaustive-contrast',
    candidates,
    maxPens,
    [],
    { basePaletteSize: basePalette.length, basePalette }
  )

  return selectedIndices
    .slice(0, maxPens)
    .map((index) => [...basePalette[index]] as Pen)
}

/**
 * For each base-palette colour, the pen standing closest to it. Computed once
 * over the base palette rather than per pixel — the same colour always lands on
 * the same pen, which is what keeps deduplication exact (Q30).
 */
function nearestPens(
  chosen: Pen[],
  basePalette: Vector[],
  offset: number
): Uint8Array {
  const penOf = new Uint8Array(basePalette.length)

  basePalette.forEach((colour, index) => {
    let best = 0
    let bestDistance = Number.POSITIVE_INFINITY
    chosen.forEach((pen, at) => {
      const distance = perceptualDistance(colour, pen)
      if (distance < bestDistance) {
        bestDistance = distance
        best = at
      }
    })
    penOf[index] = best + offset
  })

  return penOf
}

/**
 * How far each base-palette colour had to travel to reach the pen it was given.
 * Same shape as `nearestPens`, so the collision report of Q22 costs one lookup
 * per pixel — the distances are already computed to pick the pens.
 */
function penDistances(
  chosen: Pen[],
  basePalette: Vector[],
  penOf: Uint8Array,
  offset: number
): Float64Array {
  const errorOf = new Float64Array(basePalette.length)

  basePalette.forEach((colour, index) => {
    errorOf[index] = perceptualDistance(colour, chosen[penOf[index] - offset])
  })

  return errorOf
}

/**
 * Lays the tiles back out on the source grid (Q10) and pre-stretches CPC pixels
 * so the file opens undistorted in any viewer (Q9).
 */
function renderPng(
  tileset: ConvertedTileset,
  input: ConvertTilesetInput
): Uint8Array {
  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${input.mode}` as CpcModeKey]
  const tileW = input.target.tileWidth
  const tileH = input.target.tileHeight
  const width = tileset.columns * tileW * scaleX
  const height = tileset.rows * tileH * scaleY
  const indices = new Uint8Array(width * height)

  tileset.tiles.forEach((tile, at) => {
    const originX = (at % tileset.columns) * tileW * scaleX
    const originY = Math.floor(at / tileset.columns) * tileH * scaleY

    for (let y = 0; y < tileH; y++) {
      for (let x = 0; x < tileW; x++) {
        const pen = tile.indices[y * tileW + x]
        for (let dy = 0; dy < scaleY; dy++) {
          const row = (originY + y * scaleY + dy) * width + originX + x * scaleX
          indices.fill(pen, row, row + scaleX)
        }
      }
    }
  })

  return encodeIndexedPng({
    width,
    height,
    palette: tileset.palette,
    indices,
    transparentIndex: tileset.transparentPen ?? undefined
  })
}
