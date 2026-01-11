/**
 * EGX Palette Optimization
 *
 * Handles palette generation and optimization for EGX mode.
 * Ensures shared colors are placed in the first slots for high-res lines.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import { colorDistanceSquared, getSharedColorCount } from '@/libs/pixsaur-egx'
import { egxEnabledAtom } from '../../config/config'
import { userPaletteAtom } from '../../palette/palette'
import type { PaletteSlot } from '../../palette/types'
import { exportPaletteWithSlotsAtom } from '../preview'
import { egxConfigAtom } from './egx-config'
import { egxNormalizedImageAtom } from './egx-image'

// ============================================================================
// Palette Analysis Helpers
// ============================================================================

/**
 * Analyze color usage on high-resolution lines to determine
 * which colors should be in the shared slots (INK 0-3 for EGX1, INK 0-1 for EGX2)
 */
export function analyzeHighResLineColors(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig
): Map<number, number> {
  const colorUsage = new Map<number, number>()
  const { width, height } = imageData
  const data = imageData.data

  // Initialize usage counts
  for (let i = 0; i < palette.length; i++) {
    colorUsage.set(i, 0)
  }

  // Analyze only high-resolution lines
  for (let y = 0; y < height; y++) {
    const isHighResLine =
      (config.firstLineMode === 'low' && y % 2 !== 0) ||
      (config.firstLineMode === 'high' && y % 2 === 0)

    if (!isHighResLine) continue

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const pixel: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]

      // Find closest color in palette
      let bestIndex = 0
      let bestDist = Infinity
      for (let i = 0; i < palette.length; i++) {
        const dist = colorDistanceSquared(pixel, palette[i])
        if (dist < bestDist) {
          bestDist = dist
          bestIndex = i
        }
      }

      colorUsage.set(bestIndex, (colorUsage.get(bestIndex) ?? 0) + 1)
    }
  }

  return colorUsage
}

/**
 * Reorder palette so that the most used colors on high-res lines
 * are in the shared slots (first N positions).
 *
 * Also ensures color diversity: if two selected colors are too similar,
 * the second one is replaced by the next most-used distinct color.
 */
export function optimizePaletteForEGX(
  palette: Vector<'RGB'>[],
  colorUsage: Map<number, number>,
  sharedCount: number,
  isPlus: boolean = false
): Vector<'RGB'>[] {
  // Sort color indices by usage (descending)
  const sortedIndices = [...colorUsage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx]) => idx)

  // Amélioration : tester toutes les combinaisons des 8 couleurs les plus utilisées pour les slots partagés
  const topIndices = sortedIndices.slice(0, Math.max(8, sharedCount))
  let bestScore = -Infinity
  let bestCombo: number[] = []

  // Génère toutes les combinaisons possibles de sharedCount parmi topIndices
  function* combinations(arr: number[], k: number): Generator<number[]> {
    const n = arr.length
    if (k > n) return
    const indices = Array.from({ length: k }, (_, i) => i)
    while (true) {
      yield indices.map((i) => arr[i])
      let i = k - 1
      while (i >= 0 && indices[i] === n - k + i) i--
      if (i < 0) break
      indices[i]++
      for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1
    }
  }

  // Contraintes de distance uniquement pour CPC Plus (palette 12-bit plus fine)
  const MIN_DISTANCE_SQ = isPlus ? 100 * 100 : 0 // Minimum 100 RGB units pour Plus
  const MIN_LUMINANCE_DIFF = 40 // Différence de luminance minimale pour deux couleurs sombres

  // Calcule la luminance perçue (formule standard)
  const getLuminance = (c: Vector<'RGB'>): number =>
    0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

  // Vérifie si deux couleurs sont perceptuellement trop proches (uniquement pour Plus)
  const areTooClose = (c1: Vector<'RGB'>, c2: Vector<'RGB'>): boolean => {
    if (!isPlus) return false // Pas de contrainte pour Classic

    const distSq = colorDistanceSquared(c1, c2)
    if (distSq >= MIN_DISTANCE_SQ) return false

    // Pour les couleurs sombres, exiger aussi une différence de luminance
    const lum1 = getLuminance(c1)
    const lum2 = getLuminance(c2)
    if (lum1 < 80 && lum2 < 80) {
      // Les deux sont sombres : vérifier la différence de luminance
      return Math.abs(lum1 - lum2) < MIN_LUMINANCE_DIFF
    }
    return true
  }

  for (const combo of combinations(topIndices, sharedCount)) {
    // Vérifie la contrainte de distance minimale
    let valid = true
    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        if (areTooClose(palette[combo[i]], palette[combo[j]])) {
          valid = false
          break
        }
      }
      if (!valid) break
    }
    if (!valid) continue

    // Score = 0.7*couverture + 0.3*contraste
    let coverage = 0
    for (const idx of combo) coverage += colorUsage.get(idx) ?? 0
    let contrast = 0
    let pairs = 0
    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        contrast += colorDistanceSquared(palette[combo[i]], palette[combo[j]])
        pairs++
      }
    }
    contrast = pairs > 0 ? contrast / pairs : 0
    const score = 0.7 * coverage + 0.3 * contrast
    if (score > bestScore) {
      bestScore = score
      bestCombo = combo
    }
  }

  // Si aucune combinaison trouvée, fallback avec contrainte de distance
  if (bestCombo.length === 0) {
    // Sélectionne les couleurs les plus utilisées en respectant la distance minimale
    for (const idx of topIndices) {
      if (bestCombo.length >= sharedCount) break
      const candidate = palette[idx]
      const isTooClose = bestCombo.some((selectedIdx) =>
        areTooClose(candidate, palette[selectedIdx])
      )
      if (!isTooClose) {
        bestCombo.push(idx)
      }
    }
    // Si toujours pas assez, remplir avec les plus utilisées restantes
    for (const idx of topIndices) {
      if (bestCombo.length >= sharedCount) break
      if (!bestCombo.includes(idx)) {
        bestCombo.push(idx)
      }
    }
  }

  // Build remaining indices (colors not selected for shared slots)
  const remainingIndices = sortedIndices.filter(
    (idx) => !bestCombo.includes(idx)
  )

  // Build optimized palette
  const optimized: Vector<'RGB'>[] = []
  // First: shared colors (meilleure combinaison)
  for (const idx of bestCombo) {
    optimized.push(palette[idx])
  }

  // Then: remaining colors
  for (const idx of remainingIndices) {
    optimized.push(palette[idx])
  }

  // Pad with black if needed
  while (optimized.length < palette.length) {
    optimized.push([0, 0, 0])
  }

  return optimized
}

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
