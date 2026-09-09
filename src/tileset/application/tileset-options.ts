/**
 * What the workshop's options become when the user asks for something
 * (Q15 · Q16 · Q18 · Q23 · Q26 · Q28).
 *
 * The palette panel and the retouching panel used to decide this inside Jotai
 * write functions, where the only way to test a rule was to run a whole
 * conversion. Here each decision is a function of the options, of the mode
 * they were chosen against, and of what the conversion produced.
 *
 * A refusal returns the options unchanged, by reference: the atom that calls
 * one has nothing left to decide, because writing the same object back leaves
 * every derived atom downstream untouched.
 */

import type { PaletteSlot, PixelMode } from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { TileDither } from './convert-tileset'
import {
  holePen,
  type PenSpending,
  penBudget,
  penCount,
  pinnablePen
} from './pen-budget'
import type { Pen } from './pens'
import type { TilesetProjectOptions } from './tileset-project'

/** The options the panels write, and the mode they were chosen against. */
export interface TilesetSettings {
  mode: PixelMode
  options: TilesetProjectOptions
}

/** What the conversion produced, as the palette decisions need to see it. */
export interface ConvertedPalette {
  /** The pens the conversion chose, in index order. */
  palette: readonly Pen[]
}

function spendingOf({ mode, options }: TilesetSettings): PenSpending {
  return { mode, ...options }
}

export interface TilesetPaletteSlotsInput extends TilesetSettings {
  /** `null` until a sheet has been converted — there is no palette before. */
  produced: ConvertedPalette | null
}

/**
 * The palette on screen: one slot per pen the MODE holds, not per pen the
 * conversion happened to need (Q28).
 *
 * A sheet of five colours in mode 0 still shows sixteen — the eleven empty
 * ones are where a colour can be pinned, which is the whole point of the grid.
 */
export function tilesetPaletteSlots({
  mode,
  options,
  produced
}: TilesetPaletteSlotsInput): PaletteSlot[] {
  if (!produced) return []

  const spending = spendingOf({ mode, options })
  const pinned = options.lockedPens ?? {}

  return Array.from({ length: penCount(mode) }, (_unused, index) => ({
    color: (produced.palette[index] ?? null) as Vector | null,
    // Three ways a slot is not the user's to move: the hole is fixed by the
    // transparency setting, a reserved pen was promised to the sprites, and a
    // pinned one is locked because that is what pinning means.
    locked: !pinnablePen(index, spending) || pinned[index] !== undefined
  }))
}

export interface DropPenInput extends TilesetSettings {
  index: number
  color: Pen
}

/**
 * Where a colour dropped on a slot goes (Q15 · Q16 · Q26).
 *
 * Three destinations, because three things are being said: the hole's colour
 * is the background, a frozen palette IS the palette, and anything else is a
 * pin. A slot the user does not own is left alone — the conversion would
 * refuse the pin anyway, so the panel does not make it.
 */
export function dropPen({
  mode,
  options,
  index,
  color
}: DropPenInput): TilesetProjectOptions {
  const spending = spendingOf({ mode, options })

  // Past the budget the pen belongs to the sprites, whatever is dropped on it.
  if (index >= penBudget(spending)) return options

  if (index === holePen(spending)) return { ...options, background: color }

  if (!pinnablePen(index, spending)) return options

  if (options.palette) {
    const palette = [...options.palette]
    palette[index] = color
    return { ...options, palette }
  }

  return {
    ...options,
    lockedPens: { ...options.lockedPens, [index]: color }
  }
}

export interface TogglePenLockInput extends TilesetPaletteSlotsInput {
  index: number
}

/** Pins the pen the conversion gave that index, or hands it back (Q28). */
export function togglePenLock({
  mode,
  options,
  produced,
  index
}: TogglePenLockInput): TilesetProjectOptions {
  if (!pinnablePen(index, spendingOf({ mode, options }))) return options

  const pinned = options.lockedPens ?? {}
  if (pinned[index] !== undefined) {
    const { [index]: _freed, ...kept } = pinned
    return { ...options, lockedPens: kept }
  }

  const pen = produced?.palette[index]
  if (!pen) return options

  return { ...options, lockedPens: { ...pinned, [index]: pen } }
}

/**
 * Takes the palette the conversion just chose as the palette (Q26 · Q28).
 *
 * Edits are stored as pen INDICES, so a palette left free to drift would
 * silently repaint every tile that used pen 5 the next time the sheet, the
 * grid or a setting moves. Freezing is what makes an edit outlive a reglage.
 */
export function freezePalette(
  options: TilesetProjectOptions,
  palette: Pen[]
): TilesetProjectOptions {
  return { ...options, palette }
}

/**
 * Hands the palette back to the strategy, whatever the sheet now asks for.
 *
 * Also what a mode change does to it: the pens were chosen against a budget
 * the new mode has not got.
 */
export function thawPalette(
  options: TilesetProjectOptions
): TilesetProjectOptions {
  const { palette: _thawed, ...kept } = options
  return kept
}

export interface SetTileDitherInput {
  options: TilesetProjectOptions
  /** For each tile, the tile it is an instance of — the edit link of Q11. */
  instanceOf: readonly number[]
  /** Position of the tile in the sheet. */
  tile: number
  /** `null` hands the tile back to the sheet-wide setting. */
  dither: TileDither | null
}

/**
 * The per-tile overrule of Q18: a sprite wants none of the dithering a
 * gradient sky wants.
 *
 * The setting is written on every instance of the tile — otherwise two copies
 * of one tile would render differently and the deduplication that carries the
 * edits would break.
 */
export function setTileDither({
  options,
  instanceOf,
  tile,
  dither
}: SetTileDitherInput): TilesetProjectOptions {
  const group = instanceOf[tile]
  const byTile = { ...(options.ditherByTile ?? {}) }

  instanceOf.forEach((of, at) => {
    if (of !== group) return
    if (dither === null) delete byTile[at]
    else byTile[at] = dither
  })

  return { ...options, ditherByTile: byTile }
}
