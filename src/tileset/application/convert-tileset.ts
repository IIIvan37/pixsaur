/**
 * Converts a tileset sheet from another machine to CPC constraints.
 *
 * Pure, synchronous, total — no ports. The caller owns the side effects
 * (reading the source file, saving the produced PNG); this use-case only
 * computes. See `docs/features/PLAN-tileset-workshop.md`.
 */

import { type PixelMode, perceptualDistance } from '@/domain/cpc'
import {
  applyPaletteStrategyV2,
  type ColorCandidate,
  convertPreselectedToIndices
} from '@/libs/pixsaur-color/src/quant/palette-strategies-v2'
import type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  type AxisSearch,
  antiAliasTile,
  type BayerSize,
  chooseResizeScheme,
  type DiffusionColours,
  dedupeTiles,
  detectTileEdges,
  diffuseTile,
  type EdgeCondition,
  HOLE_PEN,
  orderedDitherTile,
  type PenMix,
  type PenSpace,
  penTables,
  rankTileCollisions,
  resizeTileByScheme,
  resizeTileNearest,
  type Sheet,
  type SheetGrid,
  type SourceTile,
  sliceSheet,
  type TileCollision,
  type TileEdges,
  type TileGrid,
  tileEdgeMask,
  tilePaletteHistogram
} from '@/libs/pixsaur-tileset'
import type { CPCHardware } from '@/libs/types'
import { HOLE, hardwareColours, type SnappedTile } from './hardware-colours'
import {
  chosenPens,
  penBudget,
  penSpaceOf,
  pinnablePen,
  spendsPenOnHoles
} from './pen-budget'
import { BLACK, type Pen } from './pens'

export type { Pen } from './pens'

/**
 * What is converted and where it lands — everything but the tuning.
 *
 * The same five fields are the backbone of a saved project, so both shapes
 * extend this one: a field added here reaches the conversion and the document
 * together.
 */
export interface TilesetConversionSubject {
  sheet: Sheet
  /** Where the tiles sit in the source sheet: size, margin, spacing, offset. */
  source: SheetGrid
  /** Tile size in the destination, in CPC pixels. */
  target: TileGrid
  mode: PixelMode
  hardware: CPCHardware
}

export interface ConvertTilesetInput extends TilesetConversionSubject {
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
  ditherSize?: BayerSize
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
   * Pens the user pinned by hand (Q15), keyed by the position they hold in the
   * palette: the strategy must return them, whether or not the sheet asks for
   * them, and they come back at that index. Unlike `reservedPens`, these ARE
   * quantization targets — a locked pen is a colour, not a free slot.
   *
   * The index is part of the promise, not a detail: a retouch is stored as a
   * pen index (Q19 · Q28), so a lock that moved the pens around it would
   * repaint every stroke already laid.
   */
  lockedPens?: Record<number, Pen>
}

/** One converted tile: palette indices, `target.tileWidth * tileHeight` long. */
export interface ConvertedTile {
  indices: Uint8Array
}

/** What a tile does with a colour the palette has not got (Q18). */
export type TileDither = 'none' | 'ordered' | 'diffusion'

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
  /**
   * Which search each axis of the resize ran, or `null` when the tiles were
   * resampled by nearest neighbour. Reported so an approximation past the
   * budget never reads as an exhaustive answer.
   */
  resizeSearch: { columns: AxisSearch; rows: AxisSearch } | null
}

export type ConvertTilesetResult =
  | { ok: true; tileset: ConvertedTileset }
  | {
      ok: false
      error:
        | 'grid-mismatch'
        | 'no-pens-left'
        | 'palette-too-wide'
        | 'palette-missing-hole'
        | 'locked-pen-out-of-range'
    }

export function convertTileset(
  input: ConvertTilesetInput
): ConvertTilesetResult {
  const maxPens = penBudget(input)
  if (maxPens < 1) return { ok: false, error: 'no-pens-left' }

  const frozen = checkFrozenPalette(input, maxPens)
  if (frozen) return frozen

  // The transparency pen comes first and is never a quantization target: only
  // alpha can reach it, so an opaque pixel of the same colour stays distinct.
  const space = penSpaceOf(input)

  const pinned = checkLockedPens(input)
  if (pinned) return pinned

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
  const colours = hardwareColours(input.hardware)
  const background = input.background ?? BLACK
  const snapped = tiles.map((tile) => {
    const resized = scheme
      ? resizeTileByScheme(tile, input.source, input.target, scheme)
      : resizeTileNearest(tile, input.source, input.target)
    return colours.snap(resized.data, {
      background,
      marksHoles: space.holePen !== null
    })
  })

  const palette =
    input.palette ??
    prependHolePen(
      placeLockedPens(
        selectPalette(snapped, colours.palette, chosenPens(input), input),
        lockedByChosenIndex(input, space),
        background
      ),
      space.holePen === null ? null : background
    )
  // Copied out of the hardware palette once: a colour may arrive as a typed
  // array, and the diffusion ditherer needs a plain list it can add a residual
  // to without rounding it back.
  const wanted = colours.palette.map((colour) => [...colour])
  const tables = penTables({
    wanted,
    // Everything from the first pen the strategy chose — past the hole, if the
    // mode spent one on it.
    chosen: palette.slice(space.toPalette(0)),
    distance: (a, b) => perceptualDistance(a as Vector, b as Vector),
    space
  })
  const render = {
    mix: tables.mix,
    flat: new Float64Array(wanted.length),
    colours: tables.diffusion,
    blend: colours.blend,
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
    transparentPen: space.holePen,
    resizeSearch: scheme?.search ?? null,
    collisions: rankTileCollisions(
      snapped,
      // Deduplicated BEFORE the palette, not after: two source tiles that the
      // shared palette collapsed into one are exactly the collision the report
      // exists to surface, and the converted `unique` no longer holds both.
      dedupeTiles(snapped).unique,
      tables.error,
      { ignore: HOLE }
    )
  }

  return { ok: true, tileset }
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

/**
 * Picks the pens the whole tileset shares, from a histogram weighted one unit
 * per UNIQUE tile (Q3 · Q15) and handed to one of the 12 strategies (Q15).
 */
function prependHolePen(chosen: Pen[], hole: Pen | null): Pen[] {
  return hole === null ? chosen : [hole, ...chosen]
}

/**
 * A frozen palette is used as-is (Q26 · Q28), so it is the one thing the
 * use-case cannot recompute out of a mistake: too many pens and the PNG goes
 * past what the mode can show, no hole at the head and every edit stored as
 * pen 0 repaints itself. Both are refused rather than silently corrected.
 */
function checkFrozenPalette(
  input: ConvertTilesetInput,
  maxPens: number
): { ok: false; error: 'palette-too-wide' | 'palette-missing-hole' } | null {
  const palette = input.palette
  if (!palette) return null

  if (palette.length > maxPens) return { ok: false, error: 'palette-too-wide' }

  if (!spendsPenOnHoles(input)) return null

  const background = input.background ?? BLACK
  const head = palette[HOLE_PEN]
  const leads = head?.every((channel, at) => channel === background[at])

  return leads ? null : { ok: false, error: 'palette-missing-hole' }
}

/**
 * A pinned pen must name a position the palette actually has: past the mode's
 * budget there is no register to hold it, and on the hole there is one the
 * conversion owns. Refused rather than moved — moving it is exactly what
 * pinning exists to prevent.
 */
function checkLockedPens(
  input: ConvertTilesetInput
): { ok: false; error: 'locked-pen-out-of-range' } | null {
  const locked = input.lockedPens
  if (!locked) return null

  const positions = Object.keys(locked).map(Number)
  const placeable =
    positions.length <= chosenPens(input) &&
    positions.every((at) => pinnablePen(at, input))

  return placeable ? null : { ok: false, error: 'locked-pen-out-of-range' }
}

/** Pinned pens, keyed by their position among the pens the strategy chooses. */
function lockedByChosenIndex(
  input: ConvertTilesetInput,
  space: PenSpace
): Map<number, Pen> {
  return new Map(
    Object.entries(input.lockedPens ?? {}).map(([at, pen]) => [
      space.toChosen(Number(at)),
      pen
    ])
  )
}

const samePen = (a: Pen, b: Pen) => a.every((channel, at) => channel === b[at])

/**
 * Puts each pinned pen where it was pinned and fills around it, in the order
 * the strategy returned. A position the sheet left unfilled below a pin is
 * painted the background: no pixel points at it, so only the hardware register
 * sees it, and the pins above it keep their index.
 */
function placeLockedPens(
  selected: Pen[],
  locked: Map<number, Pen>,
  filler: Pen
): Pen[] {
  if (locked.size === 0) return selected

  const free = [...selected]
  for (const pen of locked.values()) {
    const at = free.findIndex((candidate) => samePen(candidate, pen))
    if (at >= 0) free.splice(at, 1)
  }

  const highest = Math.max(...locked.keys())
  const size = Math.max(highest + 1, locked.size + free.length)
  const placed: Pen[] = new Array(size)
  for (const [at, pen] of locked) placed[at] = pen

  let cursor = 0
  for (const pen of free) {
    while (cursor < size && placed[cursor] !== undefined) cursor++
    if (cursor >= size) break
    placed[cursor] = pen
  }

  return [...placed].map((pen) => pen ?? filler)
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

  const pinned = Object.values(input.lockedPens ?? {})
  const locked = convertPreselectedToIndices(pinned, basePalette)
  const { selectedIndices } = applyPaletteStrategyV2(
    input.paletteStrategy ?? 'exhaustive-contrast',
    candidates,
    maxPens,
    locked,
    {
      basePaletteSize: basePalette.length,
      basePalette,
      preselectedColors: pinned
    }
  )

  // Pas de découpe : `PaletteStrategyFunction` promet au plus `maxPens`
  // indices, et au moins autant que les candidats en permettent.
  return selectedIndices.map((index) => [...basePalette[index]] as Pen)
}

interface RenderTools {
  mix: PenMix
  /** A mix of zero everywhere — what `dither: 'none'` reads. */
  flat: Float64Array
  colours: DiffusionColours
  blend: (sides: readonly number[]) => number
  shape: TileGrid
}

interface RenderSettings {
  dither: TileDither
  size: BayerSize | undefined
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
      ignore: HOLE
    })
  }

  // `none` is `ordered` with nothing to spread: the mix never beats a
  // threshold, so every pixel keeps the pen nearest the colour it asked for.
  return orderedDitherTile(
    smoothed,
    width,
    height,
    settings.dither === 'none' ? { ...tools.mix, mix: tools.flat } : tools.mix,
    { size: settings.size, mask, ignore: HOLE }
  )
}
