/**
 * EGX Palette Atoms
 *
 * Handles palette generation and optimization for EGX mode.
 * Pure optimization functions are in libs/pixsaur-egx/palette-reorder.ts.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  analyzeHighResLineColors,
  colorDistanceSquared,
  getSharedColorCount,
  optimizePaletteForEGX
} from '@/libs/pixsaur-egx'
import { egxEnabledAtom } from '../../config/config'
import { userPaletteAtom } from '../../palette/palette'
import type { PaletteSlot } from '../../palette/types'
import { exportPaletteWithSlotsAtom } from '../preview'
import { egxConfigAtom } from './egx-config'
import { egxNormalizedImageAtom } from './egx-image'

// ============================================================================
// EGX Palette Atoms
// ============================================================================

/**
 * Use the standard quantizer's palette for EGX.
 * Optimizes the palette so that the most used colors on high-res lines
 * are in the shared slots (INK 0-3 for EGX1, INK 0-1 for EGX2).
 * Locked colors are preserved at their positions.
 *
 * EGX1 needs 16 colors, EGX2 needs 4 colors.
 */
export const egxPaletteAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const config = get(egxConfigAtom)
  const normalizedImage = await get(egxNormalizedImageAtom)
  const userPalette = get(userPaletteAtom)

  // EGX1 et EGX2 utilisent la palette générée par le quantizer standard (qui utilise la palette strategy)
  const standardPalette = await get(exportPaletteWithSlotsAtom)
  if (!standardPalette || standardPalette.length === 0) {
    logger.warn('[EGX] No standard palette available')
    return null
  }
  const validColors = standardPalette.filter(
    (c): c is Vector<'RGB'> => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
  )

  const neededColors = config.type === 'egx1' ? 16 : 4
  const sharedCount = getSharedColorCount(config.type)

  // Identify locked slot indices (within neededColors range)
  const lockedIndices = new Set<number>()
  for (let i = 0; i < neededColors; i++) {
    if (userPalette[i]?.locked && userPalette[i]?.color) {
      lockedIndices.add(i)
    }
  }

  // Build initial palette with locked colors at their positions
  const colors: Vector<'RGB'>[] = new Array(neededColors).fill(null)

  // Place locked colors first
  for (const idx of lockedIndices) {
    const lockedColor = userPalette[idx]?.color
    if (lockedColor) {
      colors[idx] = lockedColor
    }
  }

  // Fill remaining slots with non-locked colors from validColors
  let validIdx = 0
  for (let i = 0; i < neededColors; i++) {
    if (colors[i] === null) {
      // Find next valid color that's not a duplicate of a locked color
      while (validIdx < validColors.length) {
        const color = validColors[validIdx]
        validIdx++
        // Check if this color is too similar to any locked color
        const isSimilarToLocked = [...lockedIndices].some((lockedIdx) => {
          const locked = colors[lockedIdx]
          if (!locked) return false
          return colorDistanceSquared(color, locked) < 100 // Very similar
        })
        if (!isSimilarToLocked) {
          colors[i] = color
          break
        }
      }
      // If we ran out of colors, use black
      colors[i] ??= [0, 0, 0]
    }
  }

  // Optimize palette for high-res lines, but preserve locked positions
  if (
    normalizedImage &&
    colors.length > sharedCount &&
    lockedIndices.size === 0
  ) {
    // Only reorder if no colors are locked (to preserve user's explicit choices)
    const colorUsage = analyzeHighResLineColors(normalizedImage, colors, config)
    const isPlus = config.targetHardware === 'plus'
    const optimizedColors = optimizePaletteForEGX(
      colors,
      colorUsage,
      sharedCount,
      isPlus
    )

    // Copy optimized colors back
    for (let i = 0; i < optimizedColors.length; i++) {
      colors[i] = optimizedColors[i]
    }

    logger.info('[EGX] Palette optimized for high-res lines', {
      sharedCount,
      topColors: colors.slice(0, sharedCount).map((c) => `rgb(${c.join(',')})`)
    })
  } else if (lockedIndices.size > 0) {
    logger.info('[EGX] Palette has locked colors, skipping optimization', {
      lockedIndices: [...lockedIndices]
    })
  }

  logger.info('[EGX] Palette from standard quantizer', {
    validColorsCount: validColors.length,
    neededColors,
    sharedCount,
    lockedCount: lockedIndices.size
  })

  return {
    colors,
    sharedColorCount: sharedCount,
    stats: {
      colorsUsedLowMode: neededColors,
      colorsUsedHighMode: sharedCount,
      avgErrorLowMode: 0,
      avgErrorHighMode: 0,
      totalError: 0
    }
  }
})

/**
 * Display palette for EGX mode (for ColorPalette component).
 * Returns the reordered EGX palette as PaletteSlot array.
 * Preserves locked colors from userPaletteAtom.
 */
export const egxDisplayPaletteAtom = atom(
  async (get): Promise<PaletteSlot[]> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return []

    const paletteInfo = await get(egxPaletteAtom)
    const userPalette = get(userPaletteAtom)
    if (!paletteInfo) return []

    const { colors: egxColors } = paletteInfo
    const neededColors = egxColors.length

    // Collect locked colors to filter them from EGX colors
    const lockedColors: Vector<'RGB'>[] = []
    for (let i = 0; i < 16; i++) {
      const slot = userPalette[i]
      if (slot?.locked && slot?.color) {
        lockedColors.push(slot.color)
      }
    }

    // Filter EGX colors to exclude those too similar to locked colors
    const availableEgxColors = egxColors.filter((color) => {
      return !lockedColors.some(
        (locked) => colorDistanceSquared(color, locked) < 100
      )
    })

    // Build display slots, preserving locked colors from user palette
    const slots: PaletteSlot[] = []
    let egxColorIndex = 0

    for (let i = 0; i < 16; i++) {
      const userSlot = userPalette[i]

      if (userSlot?.locked) {
        // Slot is locked: keep user's color and locked state
        slots.push({ ...userSlot })
      } else if (
        i < neededColors &&
        egxColorIndex < availableEgxColors.length
      ) {
        // Slot is not locked: use EGX optimized color (filtered)
        slots.push({
          color: availableEgxColors[egxColorIndex],
          locked: false
        })
        egxColorIndex++
      } else {
        // No more colors available
        slots.push({ color: null, locked: false })
      }
    }

    return slots
  }
)
