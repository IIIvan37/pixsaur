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
  type ColorCandidate,
  convertPreselectedToIndices
} from '@/libs/pixsaur-color/src/quant/palette-strategies-v2'
import type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { encodeIndexedPng } from '@/libs/pixsaur-png'
import {
  antiAliasTile,
  chooseResizeScheme,
  type DiffusionColours,
  dedupeTiles,
  detectTileEdges,
  diffuseTile,
  type EdgeCondition,
  orderedDitherTile,
  type PenMix,
  rankTileCollisions,
  resizeTileByScheme,
  resizeTileNearest,
  type SheetGrid,
  type SourceTile,
  sliceSheet,
  type TileCollision,
  type TileEdges,
  tileEdgeMask,
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
  /**
   * A palette to use as-is instead of choosing one — the freeze of Q26 · Q28.
   * Edits are stored as pen INDICES, so letting the palette drift after the
   * first one would silently repaint every tile that used pen 5. Includes the
   * transparency pen at index 0 when the mode spends one.
   */
  palette?: Pen[]
  /**
   * How a colour the palette has not got is said with the pens it has (Q18).
   * `none` takes the nearest pen; `ordered` mixes two through a Bayer matrix;
   * `diffusion` pushes the residual onto the neighbours. Defaults to `none`.
   */
  dither?: TileDither
  /** Side of the Bayer matrix used by `ordered`: 2, 4 or 8. Defaults to 4. */
  ditherSize?: number
  /**
   * Tiles that overrule the sheet-wide setting (Q18) — a sprite wants none of
   * the dithering a gradient sky wants. Keyed by position in the sheet.
   */
  ditherByTile?: Record<number, TileDither>
  /**
   * Whether the steps of a staircase get the pen halfway between the two sides
   * (Q17). On by default; the contours it owns are kept out of the dithering,
   * so no pixel ever goes through both passes (Q27).
   */
  antiAlias?: boolean
  /**
   * Pens the user pinned by hand (Q15): the strategy must return them, whether
   * or not the sheet asks for them. Unlike `reservedPens`, these ARE
   * quantization targets — a locked pen is a colour, not a free slot.
   */
  lockedPens?: Pen[]
}

/** One converted tile: palette indices, `target.tileWidth * tileHeight` long. */
export interface ConvertedTile {
  indices: Uint8Array
}

/** What a tile does with a colour the palette has not got (Q18). */
export type TileDither = 'none' | 'ordered' | 'diffusion'

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

  // The transparency pen comes first and is never a quantization target: only
  // alpha can reach it, so an opaque pixel of the same colour stays distinct.
  const offset = holePen === null ? 0 : 1
  const palette =
    input.palette ??
    prependHolePen(
      selectPalette(snapped, basePalette, maxPens - offset, input),
      holePen === null ? null : background
    )
  const chosen = palette.slice(offset)
  const penOf = nearestPens(chosen, basePalette, offset)
  const errorOf = penDistances(chosen, basePalette, penOf, offset)
  const render = {
    mix: penMix(chosen, basePalette, penOf, offset),
    flat: new Float64Array(basePalette.length),
    colours: diffusionColours(chosen, basePalette, offset),
    blend: blender(basePalette, baseIndexByKey, input.hardware),
    shape: input.target
  }
  const converted: ConvertedTile[] = snapped.map((tile, at) => ({
    indices: renderTile(tile, render, {
      dither: input.ditherByTile?.[at] ?? input.dither ?? 'none',
      size: input.ditherSize,
      antiAlias: input.antiAlias ?? true
    })
  }))

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
function prependHolePen(chosen: Pen[], hole: Pen | null): Pen[] {
  return hole === null ? chosen : [hole, ...chosen]
}

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

  const locked = convertPreselectedToIndices(
    input.lockedPens ?? [],
    basePalette
  )
  const { selectedIndices } = applyPaletteStrategyV2(
    input.paletteStrategy ?? 'exhaustive-contrast',
    candidates,
    maxPens,
    locked,
    {
      basePaletteSize: basePalette.length,
      basePalette,
      preselectedColors: input.lockedPens
    }
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

interface RenderTools {
  mix: PenMix
  /** A mix of zero everywhere — what `dither: 'none'` reads. */
  flat: Float64Array
  colours: DiffusionColours
  blend: (sides: readonly number[]) => number
  shape: TileSize
}

interface RenderSettings {
  dither: TileDither
  size: number | undefined
  antiAlias: boolean
}

/**
 * The partition of Q17 · Q27, applied to one tile: the edge mask hands the
 * contours to the anti-aliasing and the flats to the ditherer, and no pixel
 * ever goes through both.
 *
 * Both passes read TILE coordinates only, which is what keeps two copies of the
 * same tile identical after conversion — the edit link of Q11 rests on it.
 */
function renderTile(
  tile: SnappedTile,
  tools: RenderTools,
  settings: RenderSettings
): Uint8Array {
  const { tileWidth: width, tileHeight: height } = tools.shape
  const mask = settings.antiAlias
    ? tileEdgeMask(tile, width, height, { ignore: HOLE })
    : undefined
  const smoothed = settings.antiAlias
    ? antiAliasTile(tile, width, height, tools.blend, { ignore: HOLE })
    : tile

  if (settings.dither === 'diffusion') {
    return diffuseTile(smoothed, width, height, tools.colours, {
      mask,
      ignore: HOLE,
      holePen: TRANSPARENT_PEN
    })
  }

  // `none` is `ordered` with nothing to spread: the mix never beats a
  // threshold, so every pixel keeps the pen nearest the colour it asked for.
  return orderedDitherTile(
    smoothed,
    width,
    height,
    settings.dither === 'none' ? { ...tools.mix, mix: tools.flat } : tools.mix,
    { size: settings.size, mask, ignore: HOLE, holePen: TRANSPARENT_PEN }
  )
}

/**
 * For each base-palette colour, the two pens it sits between and how far along
 * it sits — what the ordered ditherer needs to mix them (Q18).
 *
 * The nearest pen is picked with the perceptual metric the rest of the pipeline
 * uses; the ratio is a plain RGB projection onto the segment joining the two
 * pens, because that is the axis the mixture actually travels on screen.
 */
function penMix(
  chosen: Pen[],
  basePalette: Vector[],
  penOf: Uint8Array,
  offset: number
): PenMix {
  const secondary = new Uint8Array(basePalette.length)
  const mix = new Float64Array(basePalette.length)

  basePalette.forEach((colour, index) => {
    const primary = penOf[index] - offset
    let second = primary
    let bestDistance = Number.POSITIVE_INFINITY
    chosen.forEach((pen, at) => {
      if (at === primary) return
      const distance = perceptualDistance(colour, pen)
      if (distance < bestDistance) {
        bestDistance = distance
        second = at
      }
    })
    secondary[index] = second + offset
    mix[index] = ratioBetween(colour, chosen[primary], chosen[second])
  })

  return { primary: penOf, secondary, mix }
}

/** How far `colour` sits from `from` towards `to`, clamped to the segment. */
function ratioBetween(colour: Vector, from: Pen, to: Pen): number {
  const span = to.map((c, channel) => c - from[channel])
  const squared = span.reduce((sum, c) => sum + c * c, 0)
  if (squared === 0) return 0
  const along = span.reduce(
    (sum, c, channel) => sum + c * (colour[channel] - from[channel]),
    0
  )
  return Math.min(1, Math.max(0, along / squared))
}

/** The three colour lookups the error-diffusion ditherer asks for. */
function diffusionColours(
  chosen: Pen[],
  basePalette: Vector[],
  offset: number
): DiffusionColours {
  // Copied out of the base palette once: `Vector` may be a typed array, and
  // the ditherer needs a plain list it can add its residual to.
  const wanted = basePalette.map((colour) => [...colour])

  return {
    wanted: (index) => wanted[index],
    painted: (pen) => chosen[pen - offset],
    nearest: (colour) => {
      let best = 0
      let bestDistance = Number.POSITIVE_INFINITY
      chosen.forEach((pen, at) => {
        const distance = perceptualDistance(colour as Vector, pen)
        if (distance < bestDistance) {
          bestDistance = distance
          best = at
        }
      })
      return best + offset
    }
  }
}

/**
 * Averages the two sides of a staircase step and snaps the result back onto the
 * hardware, so the anti-aliasing stays inside the base palette every other pass
 * works in.
 */
function blender(
  basePalette: Vector[],
  indexByKey: ReadonlyMap<string, number>,
  hardware: CPCHardware
): (sides: readonly number[]) => number {
  return (sides) => {
    const mixed = [0, 1, 2].map(
      (channel) =>
        sides.reduce((sum, side) => sum + basePalette[side][channel], 0) /
        sides.length
    ) as Vector
    const index = indexByKey.get(
      colorToKey(quantizeColorForHardware(mixed, hardware))
    )
    invariant(index !== undefined, 'blended colour is off the hardware palette')
    return index
  }
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
