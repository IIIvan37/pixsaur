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
export function assignColorsToInks(
  lineColors: Vector<'RGB'>[],
  previousPalette: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  const numInks = previousPalette.length
  const newPalette = previousPalette.map((c) => [...c]) as Vector<'RGB'>[]

  // If no colors on this line, keep previous palette
  if (lineColors.length === 0) {
    return newPalette
  }

  // Track which line colors have been assigned and which inks are used
  const assignedColors = new Set<string>()
  const usedInks = new Set<number>()

  // First pass: exact matches - keep colors in the same ink position
  for (let inkIndex = 0; inkIndex < numInks; inkIndex++) {
    const prevColor = previousPalette[inkIndex]
    const prevKey = colorKey(prevColor)

    for (const lineColor of lineColors) {
      const lineKey = colorKey(lineColor)
      if (lineKey === prevKey && !assignedColors.has(lineKey)) {
        // Exact match - keep in same position
        newPalette[inkIndex] = lineColor
        assignedColors.add(lineKey)
        usedInks.add(inkIndex)
        break
      }
    }
  }

  // Second pass: assign remaining line colors to unused ink slots
  for (const lineColor of lineColors) {
    const lineKey = colorKey(lineColor)
    if (assignedColors.has(lineKey)) continue

    // Find first unused ink slot
    for (let inkIndex = 0; inkIndex < numInks; inkIndex++) {
      if (!usedInks.has(inkIndex)) {
        newPalette[inkIndex] = lineColor
        assignedColors.add(lineKey)
        usedInks.add(inkIndex)
        break
      }
    }
  }

  return newPalette
}

// Re-export utilities for convenience
export { colorKey, colorsEqual } from './palette-selection'
