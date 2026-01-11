/**
 * Palette export atoms for preview pipeline.
 *
 * Handles palette reconstruction for display and export:
 * - Display palette combining user slots with quantized colors
 * - Export palette with proper slot handling (locked, empty, ignored)
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import {
  extractLockedColors,
  filterPaletteByLockedColors,
  findDarkestValidColor,
  IGNORED_SLOT,
  quantizeColorForHardware
} from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { CPCHardware } from '@/libs/types'
import { cpcHardwareAtom, effectiveModeConfigAtom } from '../../config/config'
import { userPaletteAtom } from '../../palette/palette'
import type { PaletteSlot } from '../../palette/types'
import { reducedPaletteRgbAtom } from './quantization'

// ============================================================================
// DISPLAY PALETTE
// ============================================================================

/**
 * Palette for display in ColorPalette component.
 * Combines locked state from userPaletteAtom with colors from reducedPaletteRgbAtom.
 */
export const displayPaletteAtom = atom(async (get) => {
  const userPalette = get(userPaletteAtom)
  const reducedPalette = await get(reducedPaletteRgbAtom)
  const modeConfig = get(effectiveModeConfigAtom)

  // Filter colors too close to locked colors
  const lockedColors = extractLockedColors(userPalette)
  const filteredReduced = filterPaletteByLockedColors(
    reducedPalette,
    lockedColors
  )

  const displaySlots: PaletteSlot[] = []
  let reducedIndex = 0

  for (let i = 0; i < 16; i++) {
    const slot = userPalette[i]
    if (i >= modeConfig.nColors || slot?.locked) {
      // Outside current mode or locked slot: keep as-is
      displaySlots.push({ ...slot })
    } else if (reducedIndex < filteredReduced.length) {
      // Unlocked slot: use color from filteredReduced
      const color = filteredReduced[reducedIndex]
      displaySlots.push({
        color: color,
        locked: false
      })
      reducedIndex++
    } else {
      // Unlocked slot: no color available
      displaySlots.push({ color: null, locked: false })
    }
  }

  return displaySlots
})

// ============================================================================
// EXPORT PALETTE
// ============================================================================

/**
 * Helper to process a single palette slot for export.
 * Returns the appropriate color Vector based on slot state.
 */
function processSlot(
  slot: PaletteSlot | undefined,
  filteredReduced: Vector[],
  reducedIndex: { value: number },
  darkestColor: Vector,
  cpcHardware: CPCHardware
): Vector {
  if (slot?.locked && slot.color === null) {
    return IGNORED_SLOT
  }
  if (slot?.locked && slot.color) {
    return quantizeColorForHardware(slot.color, cpcHardware)
  }
  if (reducedIndex.value < filteredReduced.length) {
    return filteredReduced[reducedIndex.value++]
  }
  return darkestColor
}

/**
 * Export palette with full slot structure.
 * Reconstructs complete palette with locked empty slots marked as IGNORED_SLOT [-1,-1,-1].
 * Used for export operations and preview rendering.
 */
export const exportPaletteWithSlotsAtom = atom(async (get) => {
  const reducedPalette = await get(reducedPaletteRgbAtom)
  const userPalette = get(userPaletteAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const cpcHardware = get(cpcHardwareAtom)

  if (reducedPalette.length === 0) {
    return [] as Vector[]
  }

  // Find darkest color to fill empty slots
  const darkestColor = findDarkestValidColor(reducedPalette)

  // Filter colors too close to locked colors
  const lockedColors = extractLockedColors(userPalette)
  const filteredReduced = filterPaletteByLockedColors(
    reducedPalette,
    lockedColors
  )

  // Reconstruct full palette using userPalette as reference
  const fullPalette: Vector[] = []
  const reducedIndex = { value: 0 } // Mutable counter to traverse filteredReduced

  for (let i = 0; i < modeConfig.nColors; i++) {
    fullPalette.push(
      processSlot(
        userPalette[i],
        filteredReduced,
        reducedIndex,
        darkestColor,
        cpcHardware
      )
    )
  }

  logger.info('[Preview] exportPaletteWithSlotsAtom', {
    reducedPaletteLength: reducedPalette.length,
    fullPaletteLength: fullPalette.length,
    lockedEmptySlots: userPalette
      .slice(0, modeConfig.nColors)
      .map((s, i) => ({ i, isEmpty: s.locked && s.color === null }))
      .filter((s) => s.isEmpty),
    palette: fullPalette.map((c, i) => ({ i, color: c }))
  })

  return fullPalette
})
