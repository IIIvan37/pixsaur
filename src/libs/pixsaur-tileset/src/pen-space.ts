/**
 * Where the pens sit once transparency has taken one (Q16).
 *
 * A palette that spends a pen on holes carries it first, so every colour of the
 * sheet sits one index further along than the strategy that chose it thinks.
 * That single bit used to travel as a bare `offset: number` through six
 * signatures and be re-derived in eleven places; here it is a value the callers
 * ask questions of.
 */

/** A hole always takes the first pen — the one CPC sprite routines test. */
export const HOLE_PEN = 0

/** Options for a tile pass that must leave the holes alone. */
export interface HoleMarking {
  /** A value that stands for no colour at all — the hole marker of Q16. */
  ignore?: number
}

/** Options for a tile pass that also writes the holes out as a pen. */
export interface HoleWriting extends HoleMarking {
  /** Pen a hole is written as. Defaults to `HOLE_PEN`. */
  holePen?: number
}

export interface PenSpace {
  /** The pen the holes take, or `null` when the alpha was flattened. */
  readonly holePen: number | null
  /** Where a palette index sits among the pens the strategy chose. */
  toChosen(pen: number): number
  /** Where a pen the strategy chose sits in the palette. */
  toPalette(chosen: number): number
  /** Whether that palette index is the hole's rather than the sheet's. */
  isHole(pen: number): boolean
}

export function penSpace(holePen: number | null): PenSpace {
  const offset = holePen === null ? 0 : 1

  return {
    holePen,
    toChosen: (pen) => pen - offset,
    toPalette: (chosen) => chosen + offset,
    isHole: (pen) => pen === holePen
  }
}
