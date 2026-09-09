/**
 * How many pens the mode has, and what they are spent on (Q16 · Q23).
 *
 * One home for arithmetic three places used to do apart: the conversion bounds
 * its palette with it, the palette panel greys out what the mode cannot spare,
 * and the store refuses an edit on a pen that is not the user's. Two of them
 * disagreeing is a pin that survives the panel and dies in the conversion.
 */

import { CPC_MODE_CONFIG, type CpcModeKey, type PixelMode } from '@/domain/cpc'

/** What becomes of an alpha channel (Q16). */
export type Transparency = 'pen' | 'flatten'

/**
 * What a mode's pens are spent on, beyond the colours of the sheet.
 *
 * The shape both `ConvertTilesetInput` and the workshop's options already
 * have on hand — neither has to build one to ask a question.
 */
export interface PenSpending {
  mode: PixelMode
  /** Pens kept out of the quantization, so the sprites can have them (Q23). */
  reservedPens?: number
  transparency?: Transparency
}

/** A hole always takes the first pen — the one CPC sprite routines test. */
export const HOLE_PEN = 0

/** How many pens the mode holds — 16, 4 or 2. */
export function penCount(mode: PixelMode): number {
  return CPC_MODE_CONFIG[`${mode}` as CpcModeKey].nColors
}

/**
 * Whether the mode has a pen to spare at all.
 *
 * Only mode 0 does: mode 1 holds four pens and mode 2 holds two, so neither
 * can promise one to the sprites or spend one on a hole.
 */
export function hasPensToSpare(mode: PixelMode): boolean {
  return mode === 0
}

/** What becomes of an alpha channel, the mode's own default included (Q16). */
export function transparencyOf({
  mode,
  transparency
}: PenSpending): Transparency {
  return transparency ?? (hasPensToSpare(mode) ? 'pen' : 'flatten')
}

/** Whether one pen stands for a hole rather than for a colour of the sheet. */
export function spendsPenOnHoles(spending: PenSpending): boolean {
  return transparencyOf(spending) === 'pen'
}

/** The pen the holes take, or `null` when alpha is flattened (Q16). */
export function holePen(spending: PenSpending): number | null {
  return spendsPenOnHoles(spending) ? HOLE_PEN : null
}

/** How many pens the tileset may spend: the rest belong to the sprites (Q23). */
export function penBudget({ mode, reservedPens }: PenSpending): number {
  return penCount(mode) - (reservedPens ?? 0)
}

/**
 * Whether that pen is the user's to pin (Q15 · Q16 · Q23).
 *
 * Below the budget's floor sits the hole, whose colour the conversion owns;
 * past its ceiling there is no register to hold a pen at all. Both are refused
 * rather than moved — moving a pin is exactly what pinning exists to prevent.
 */
export function pinnablePen(index: number, spending: PenSpending): boolean {
  return (
    Number.isInteger(index) &&
    index >= (spendsPenOnHoles(spending) ? 1 : 0) &&
    index < penBudget(spending)
  )
}
