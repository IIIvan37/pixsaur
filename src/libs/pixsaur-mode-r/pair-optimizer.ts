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
  config: ModeRConfig = DEFAULT_MODE_R_CONFIG
): ModeRPalettes {
  // Get available hardware colors
  const availableColors =
    config.targetHardware === 'plus'
      ? generateCPCPlusPalette()
      : generateCPCClassicPalette()

  // For palette A, select colors that are close to target colors
  // and also span the color space well
  const paletteA = selectDiverseColors(targetColors, availableColors, 16)

  // For palette B, we want colors that complement palette A
  // Calculate what B colors we'd need to blend to each target
  const neededBColors: Vector<'RGB'>[] = []
  for (const target of targetColors) {
    // For each A color, calculate ideal B: blend(A, B) = target → B = 2*target - A
    for (const colorA of paletteA) {
      const idealB: Vector<'RGB'> = [
        Math.max(0, Math.min(255, 2 * target[0] - colorA[0])),
        Math.max(0, Math.min(255, 2 * target[1] - colorA[1])),
        Math.max(0, Math.min(255, 2 * target[2] - colorA[2]))
      ]
      neededBColors.push(idealB)
    }
  }

  // Select palette B to cover the needed complementary colors
  const paletteB = selectDiverseColors(neededBColors, availableColors, 16)

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
