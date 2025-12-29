/**
 * Mode R Palette Optimizer
 *
 * Creates two independent 16-color palettes (A and B) that maximize
 * the diversity of blended colors. With 16×16 = 256 possible blends,
 * Mode R can represent far more colors than standard Mode 0.
 */

import { logger } from '@/core/logger'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { blendColors, calculateFlickerScore, colorDistance } from './blend'
import type {
  ModeRColorPair,
  ModeRConfig,
  ModeRPaletteStats,
  ModeRPalettes
} from './types'
import { DEFAULT_MODE_R_CONFIG } from './types'

/**
 * Generate all valid CPC Plus colors (4096 total)
 */
function generateCPCPlusPalette(): Vector<'RGB'>[] {
  const colors: Vector<'RGB'>[] = []
  for (let r = 0; r < 16; r++) {
    for (let g = 0; g < 16; g++) {
      for (let b = 0; b < 16; b++) {
        colors.push([r * 17, g * 17, b * 17])
      }
    }
  }
  return colors
}

/**
 * Generate all valid CPC Classic colors (27 total)
 */
function generateCPCClassicPalette(): Vector<'RGB'>[] {
  const levels = [0, 128, 255]
  const colors: Vector<'RGB'>[] = []
  for (const r of levels) {
    for (const g of levels) {
      for (const b of levels) {
        colors.push([r, g, b])
      }
    }
  }
  return colors
}

/**
 * Find the nearest available color to a target
 */
function findNearestColor(
  target: Vector<'RGB'>,
  available: Vector<'RGB'>[]
): Vector<'RGB'> {
  let nearest = available[0]
  let minDist = colorDistance(target, nearest)

  for (const color of available) {
    const dist = colorDistance(target, color)
    if (dist < minDist) {
      minDist = dist
      nearest = color
    }
  }

  return nearest
}

/**
 * Check if a color is sufficiently different from all colors in a set
 */
function isColorDiverse(
  color: Vector<'RGB'>,
  existingColors: Vector<'RGB'>[],
  minDistance: number
): boolean {
  for (const existing of existingColors) {
    if (colorDistance(color, existing) < minDistance) {
      return false
    }
  }
  return true
}

/**
 * Check if a color is similar to any color in a list
 */
function isColorInList(
  color: Vector<'RGB'>,
  list: Vector<'RGB'>[],
  maxDistance: number
): boolean {
  for (const c of list) {
    if (colorDistance(color, c) < maxDistance) {
      return true
    }
  }
  return false
}

/**
 * Add diverse colors from available palette to fill remaining slots
 */
function fillWithDiverseColors(
  selected: Vector<'RGB'>[],
  usedKeys: Set<string>,
  available: Vector<'RGB'>[],
  count: number,
  minDistance: number
): void {
  for (const color of available) {
    if (selected.length >= count) break

    const key = `${color[0]},${color[1]},${color[2]}`
    if (usedKeys.has(key)) continue

    if (isColorDiverse(color, selected, minDistance)) {
      selected.push(color)
      usedKeys.add(key)
    }
  }
}

/**
 * Select best matching colors from available palette for CPC Plus.
 * Since CPC Plus has 4096 colors, we can find near-exact matches.
 * This ensures we use the full color range instead of a sparse selection.
 */
function selectBestMatchingColors(
  targetColors: Vector<'RGB'>[],
  available: Vector<'RGB'>[],
  count: number
): Vector<'RGB'>[] {
  // Handle empty inputs
  if (available.length === 0 || targetColors.length === 0) {
    return []
  }

  // For each target, find the best matching available color
  const matchedColors: Array<{ color: Vector<'RGB'>; score: number }> = []

  for (const target of targetColors) {
    const nearest = findNearestColor(target, available)
    const distance = colorDistance(target, nearest)
    matchedColors.push({ color: nearest, score: distance })
  }

  // Sort by match quality (lower distance = better match)
  matchedColors.sort((a, b) => a.score - b.score)

  // Take unique colors, prioritizing best matches
  const selected: Vector<'RGB'>[] = []
  const usedKeys = new Set<string>()

  for (const match of matchedColors) {
    if (selected.length >= count) break

    const key = `${match.color[0]},${match.color[1]},${match.color[2]}`
    if (!usedKeys.has(key)) {
      selected.push(match.color)
      usedKeys.add(key)
    }
  }

  // If we still need more colors, add diverse colors from available
  if (selected.length < count) {
    fillWithDiverseColors(selected, usedKeys, available, count, 1000)
  }

  return selected
}

/**
 * Calculate how many new targets a candidate color helps cover
 */
function countNewCoverage(
  candidate: Vector<'RGB'>,
  targetColors: Vector<'RGB'>[],
  coveredTargets: Set<number>,
  threshold: number
): number {
  let count = 0
  for (let t = 0; t < targetColors.length; t++) {
    if (coveredTargets.has(t)) continue
    if (colorDistance(candidate, targetColors[t]) < threshold) {
      count++
    }
  }
  return count
}

/**
 * Calculate minimum distance from a color to any in a list
 */
function minDistanceToSet(
  color: Vector<'RGB'>,
  colorSet: Vector<'RGB'>[]
): number {
  let minDist = Infinity
  for (const c of colorSet) {
    const dist = colorDistance(color, c)
    if (dist < minDist) minDist = dist
  }
  return minDist
}

/**
 * Mark targets as covered by a color
 */
function markCoveredTargets(
  color: Vector<'RGB'>,
  targetColors: Vector<'RGB'>[],
  coveredTargets: Set<number>,
  threshold: number
): void {
  for (let t = 0; t < targetColors.length; t++) {
    if (
      !coveredTargets.has(t) &&
      colorDistance(color, targetColors[t]) < threshold
    ) {
      coveredTargets.add(t)
    }
  }
}

/**
 * Find the best candidate for selection based on coverage and diversity
 */
function findBestCandidate(
  available: Vector<'RGB'>[],
  usedIndices: Set<number>,
  targetColors: Vector<'RGB'>[],
  coveredTargets: Set<number>,
  selected: Vector<'RGB'>[]
): number {
  const COVERAGE_THRESHOLD = 5000 // ~70 per channel
  let bestIdx = -1
  let bestScore = -Infinity

  for (let i = 0; i < available.length; i++) {
    if (usedIndices.has(i)) continue

    const newCoverage = countNewCoverage(
      available[i],
      targetColors,
      coveredTargets,
      COVERAGE_THRESHOLD
    )
    const diversityBonus =
      selected.length > 0
        ? Math.sqrt(minDistanceToSet(available[i], selected)) / 50
        : 0
    const score = newCoverage + diversityBonus

    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  return bestIdx
}

/**
 * Fallback: find the color furthest from all selected
 */
function findMostDiverseCandidate(
  available: Vector<'RGB'>[],
  usedIndices: Set<number>,
  selected: Vector<'RGB'>[]
): number {
  let bestIdx = -1
  let maxMinDist = -1

  for (let i = 0; i < available.length; i++) {
    if (usedIndices.has(i)) continue
    const minDist = minDistanceToSet(available[i], selected)
    if (minDist > maxMinDist) {
      maxMinDist = minDist
      bestIdx = i
    }
  }

  return bestIdx
}

/**
 * Select colors from available palette that best cover the target colors
 * while maintaining diversity. Uses a greedy approach that balances
 * coverage and spread.
 */
function selectDiverseColors(
  targetColors: Vector<'RGB'>[],
  available: Vector<'RGB'>[],
  count: number
): Vector<'RGB'>[] {
  if (available.length <= count) {
    return [...available]
  }

  const COVERAGE_THRESHOLD = 5000
  const selected: Vector<'RGB'>[] = []
  const usedIndices = new Set<number>()
  const coveredTargets = new Set<number>()

  while (selected.length < count) {
    let bestIdx = findBestCandidate(
      available,
      usedIndices,
      targetColors,
      coveredTargets,
      selected
    )

    if (bestIdx === -1) {
      bestIdx = findMostDiverseCandidate(available, usedIndices, selected)
    }

    if (bestIdx === -1) break

    const newColor = available[bestIdx]
    selected.push(newColor)
    usedIndices.add(bestIdx)
    markCoveredTargets(
      newColor,
      targetColors,
      coveredTargets,
      COVERAGE_THRESHOLD
    )
  }

  return selected
}

/**
 * Calculate ideal B colors needed to blend with paletteA to reach target colors
 */
function calculateNeededBColors(
  targetColors: Vector<'RGB'>[],
  paletteA: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  const neededBColors: Vector<'RGB'>[] = []
  for (const target of targetColors) {
    for (const colorA of paletteA) {
      // blend(A, B) = target → B = 2*target - A
      const idealB: Vector<'RGB'> = [
        Math.max(0, Math.min(255, 2 * target[0] - colorA[0])),
        Math.max(0, Math.min(255, 2 * target[1] - colorA[1])),
        Math.max(0, Math.min(255, 2 * target[2] - colorA[2]))
      ]
      neededBColors.push(idealB)
    }
  }
  return neededBColors
}

/**
 * Select palette B for CPC Plus using hybrid approach
 */
function selectPaletteBForPlus(
  paletteA: Vector<'RGB'>[],
  targetColors: Vector<'RGB'>[],
  availableColors: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  // Take the 8 most important colors from paletteA (shared = pure colors)
  const sharedColors = paletteA.slice(0, 8)

  // Find colors that create useful blends
  const neededBColors = calculateNeededBColors(targetColors, paletteA)

  // Filter out colors too similar to shared ones
  const filteredAvailable = availableColors.filter(
    (c) => !isColorInList(c, sharedColors, 500)
  )

  // Select 8 complementary colors (fallback to full palette if filter is too aggressive)
  const complementaryColors = selectBestMatchingColors(
    neededBColors,
    filteredAvailable.length > 0 ? filteredAvailable : availableColors,
    8
  )

  return [...sharedColors, ...complementaryColors]
}

/**
 * Create two independent palettes of 16 colors each that maximize
 * the coverage of target colors through their blends.
 *
 * Strategy:
 * 1. Palette A: Select 16 colors that cover the target colors well
 * 2. Palette B: Select 16 colors that, combined with A, produce useful blends
 *
 * With 16×16 = 256 possible blend combinations, Mode R can represent
 * far more perceived colors than standard Mode 0's 16 colors.
 */
export function optimizeModeRPalettes(
  targetColors: Vector<'RGB'>[],
  config: ModeRConfig = DEFAULT_MODE_R_CONFIG,
  existingPalette?: Vector<'RGB'>[]
): ModeRPalettes {
  // Get available hardware colors
  const availableColors =
    config.targetHardware === 'plus'
      ? generateCPCPlusPalette()
      : generateCPCClassicPalette()

  logger.info('[Mode R] Starting palette optimization', {
    hardware: config.targetHardware,
    availableColors: availableColors.length,
    targetColors: targetColors.length,
    usingExistingPalette: !!existingPalette
  })

  // Select palette A:
  // - If existing palette provided, use it (preserves standard mode colors like bright yellow)
  // - Otherwise, compute from scratch
  let paletteA: Vector<'RGB'>[]
  if (existingPalette && existingPalette.length > 0) {
    // Use existing palette as-is (already optimized for the image)
    paletteA = existingPalette.slice(0, 16)
    while (paletteA.length < 16) paletteA.push([0, 0, 0])
    logger.info('[Mode R] Using existing palette for palette A', {
      colors: paletteA.length
    })
  } else {
    paletteA =
      config.targetHardware === 'plus'
        ? selectBestMatchingColors(targetColors, availableColors, 16)
        : selectDiverseColors(targetColors, availableColors, 16)
  }

  // Select palette B based on dual palette option
  let paletteB: Vector<'RGB'>[]
  if (config.useDualPalette) {
    // Dual palette mode: optimize B independently for more color coverage
    if (config.targetHardware === 'plus') {
      paletteB = selectPaletteBForPlus(paletteA, targetColors, availableColors)
    } else {
      const neededBColors = calculateNeededBColors(targetColors, paletteA)
      paletteB = selectDiverseColors(neededBColors, availableColors, 16)
    }
    logger.info('[Mode R] Using dual palette mode (independent palettes)')
  } else {
    // Single palette mode: use same palette for both frames (no flicker from palette)
    paletteB = [...paletteA]
    logger.info(
      '[Mode R] Using single palette mode (same palette for both frames)'
    )
  }

  // Pad palettes to 16 if needed
  while (paletteA.length < 16) paletteA.push([0, 0, 0])
  while (paletteB.length < 16) paletteB.push([0, 0, 0])

  // Build pairs info (for compatibility)
  const pairs: ModeRColorPair[] = []
  for (let i = 0; i < 16; i++) {
    pairs.push({
      index: i,
      colorA: paletteA[i],
      colorB: paletteB[i],
      blendedColor: blendColors(paletteA[i], paletteB[i]),
      flickerScore: calculateFlickerScore(paletteA[i], paletteB[i])
    })
  }

  // Calculate statistics for ALL possible blends (16×16 = 256)
  const stats = calculateFullPaletteStats(paletteA, paletteB, config)

  logger.info('[Mode R] Dual palette optimization:', {
    targetColors: targetColors.length,
    paletteAUnique: new Set(paletteA.map((c) => `${c[0]},${c[1]},${c[2]}`))
      .size,
    paletteBUnique: new Set(paletteB.map((c) => `${c[0]},${c[1]},${c[2]}`))
      .size,
    possibleBlends: stats.uniquePerceivedColors,
    hardware: config.targetHardware
  })

  return { paletteA, paletteB, pairs, stats }
}

/**
 * Calculate statistics for two full palettes (16×16 blends)
 */
function calculateFullPaletteStats(
  paletteA: Vector<'RGB'>[],
  paletteB: Vector<'RGB'>[],
  config: ModeRConfig
): ModeRPaletteStats {
  const uniqueBlends = new Set<string>()
  let totalFlicker = 0
  let maxFlicker = 0
  let noFlickerCount = 0
  let validPairCount = 0

  for (const colorA of paletteA) {
    for (const colorB of paletteB) {
      const blended = blendColors(colorA, colorB)
      const flicker = calculateFlickerScore(colorA, colorB)

      // Count all pairs, but track those within flicker tolerance
      uniqueBlends.add(
        `${Math.round(blended[0])},${Math.round(blended[1])},${Math.round(blended[2])}`
      )

      if (flicker <= config.maxLuminanceDelta) {
        totalFlicker += flicker
        validPairCount++
        if (flicker === 0) noFlickerCount++
      }

      if (flicker > maxFlicker) maxFlicker = flicker
    }
  }

  return {
    averageFlicker: validPairCount > 0 ? totalFlicker / validPairCount : 0,
    maxFlicker,
    noFlickerPairs: noFlickerCount,
    uniquePerceivedColors: uniqueBlends.size
  }
}

/**
 * Export for testing
 */
export { generateCPCClassicPalette, generateCPCPlusPalette, findNearestColor }
