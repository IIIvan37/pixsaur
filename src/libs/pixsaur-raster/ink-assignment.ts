/**
 * Ink Assignment
 *
 * Functions for assigning colors to ink indices.
 * Minimizes palette changes between lines for smooth raster transitions.
 */

import type { Vector } from '../pixsaur-color/src/type'
import { colorKey } from './palette-selection'

/**
 * Find the best assignment of line colors to ink indices.
 * Tries to minimize changes from the previous palette by matching similar colors.
 *
 * @param lineColors - Colors found on this line (up to 4)
 * @param previousPalette - The palette from the previous line
 * @returns New palette with lineColors assigned to ink indices
 */
/** Mutable bookkeeping shared across the two assignment passes. */
interface InkAssignmentState {
  newPalette: Vector<'RGB'>[]
  assignedColors: Set<string>
  usedInks: Set<number>
}

/**
 * First pass: keep any line color that exactly matches the previous palette in
 * its original ink position, so unchanged colors never move.
 */
function assignExactMatches(
  previousPalette: Vector<'RGB'>[],
  lineColors: Vector<'RGB'>[],
  state: InkAssignmentState
): void {
  previousPalette.forEach((prevColor, inkIndex) => {
    const prevKey = colorKey(prevColor)
    const match = state.assignedColors.has(prevKey)
      ? undefined
      : lineColors.find((lineColor) => colorKey(lineColor) === prevKey)
    if (match) {
      state.newPalette[inkIndex] = match
      state.assignedColors.add(prevKey)
      state.usedInks.add(inkIndex)
    }
  })
}

/** Second pass: place each not-yet-assigned line color into the first free ink. */
function assignRemainingToFreeInks(
  lineColors: Vector<'RGB'>[],
  numInks: number,
  state: InkAssignmentState
): void {
  for (const lineColor of lineColors) {
    const lineKey = colorKey(lineColor)
    if (state.assignedColors.has(lineKey)) continue

    for (let inkIndex = 0; inkIndex < numInks; inkIndex++) {
      if (!state.usedInks.has(inkIndex)) {
        state.newPalette[inkIndex] = lineColor
        state.assignedColors.add(lineKey)
        state.usedInks.add(inkIndex)
        break
      }
    }
  }
}

export function assignColorsToInks(
  lineColors: Vector<'RGB'>[],
  previousPalette: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  const newPalette = previousPalette.map((c) => [...c]) as Vector<'RGB'>[]

  // If no colors on this line, keep previous palette
  if (lineColors.length === 0) {
    return newPalette
  }

  const state: InkAssignmentState = {
    newPalette,
    assignedColors: new Set<string>(),
    usedInks: new Set<number>()
  }

  assignExactMatches(previousPalette, lineColors, state)
  assignRemainingToFreeInks(lineColors, previousPalette.length, state)

  return newPalette
}

// Re-export utilities for convenience
export { colorKey, colorsEqual } from './palette-selection'
