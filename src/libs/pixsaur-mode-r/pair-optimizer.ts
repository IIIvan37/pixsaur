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
 * Select a palette optimized for Mode R blending.
 *
 * OPTIMIZED: Uses voting approach instead of greedy O(n²) search.
 *
 * For palette A (used alone), we want colors that:
 * 1. Match target colors directly (self-blend)
 * 2. Combine well with each other to produce diverse blends
 *
 * Strategy: Vote for colors based on how close they are to target colors.
 * Then ensure diversity in selection.
 */
function selectPaletteForBlends(
  targetColors: Vector<'RGB'>[],
  targetWeights: number[],
  available: Vector<'RGB'>[],
  count: number,
  _maxFlicker: number
): Vector<'RGB'>[] {
  const selected: Vector<'RGB'>[] = []
  const usedKeys = new Set<string>()

  // PHASE 1: Vote for candidates based on proximity to targets
  const candidateScores = new Map<
    string,
    { color: Vector<'RGB'>; score: number }
  >()

  for (let t = 0; t < targetColors.length; t++) {
    const target = targetColors[t]
    const weight = targetWeights[t]

    // Find nearest available color to target
    const nearest = findNearestColor(target, available)
    const key = `${nearest[0]},${nearest[1]},${nearest[2]}`

    const dist = colorDistance(target, nearest)
    const score = weight * Math.max(0, 10000 - dist)

    const existing = candidateScores.get(key)
    if (existing) {
      existing.score += score
    } else {
      candidateScores.set(key, { color: nearest, score })
    }
  }

  // Sort by score
  const sortedCandidates = [...candidateScores.values()].sort(
    (a, b) => b.score - a.score
  )

  // PHASE 2: Select top candidates with diversity constraint
  const MIN_DIVERSITY = 80

  for (const candidate of sortedCandidates) {
    if (selected.length >= count) break

    const key = `${candidate.color[0]},${candidate.color[1]},${candidate.color[2]}`
    if (usedKeys.has(key)) continue

    if (
      selected.length === 0 ||
      isColorDiverse(candidate.color, selected, MIN_DIVERSITY)
    ) {
      selected.push(candidate.color)
      usedKeys.add(key)
    }
  }

  // PHASE 3: Relax diversity if needed to fill palette
  for (const candidate of sortedCandidates) {
    if (selected.length >= count) break

    const key = `${candidate.color[0]},${candidate.color[1]},${candidate.color[2]}`
    if (!usedKeys.has(key)) {
      selected.push(candidate.color)
      usedKeys.add(key)
    }
  }

  // Pad with diverse colors if still not enough
  fillWithDiverseColors(selected, usedKeys, available, count, 50)

  logger.info('[Mode R] Palette A selected (voting)', {
    numSelected: selected.length,
    candidatesEvaluated: candidateScores.size
  })

  return selected
}

/**
 * Select palette B optimized for blending with palette A to cover target colors
 *
 * For CPC Plus: Use a complementary color strategy - select colors that are
 * different from palette A but still match target colors well, maximizing
 * the range of possible blends.
 *
 * For CPC Classic: Use the ideal blend calculation since the palette is limited.
 */
function selectOptimizedPaletteB(
  paletteA: Vector<'RGB'>[],
  targetColors: Vector<'RGB'>[],
  targetWeights: number[],
  availableColors: Vector<'RGB'>[],
  config: ModeRConfig
): Vector<'RGB'>[] {
  const isCPCPlus = config.targetHardware === 'plus'

  if (isCPCPlus) {
    return selectPaletteBForCPCPlus(
      paletteA,
      targetColors,
      targetWeights,
      availableColors,
      config.maxLuminanceDelta
    )
  } else {
    return selectPaletteBForCPCClassic(
      paletteA,
      targetColors,
      targetWeights,
      availableColors
    )
  }
}

/**
 * CPC Plus strategy for palette B:
 *
 * Optimize palette B to maximize blend coverage with palette A.
 * For each target color T, we need a pair (A[i], B[j]) such that:
 *   blend(A[i], B[j]) = (A[i] + B[j]) / 2 ≈ T
 *   => B[j] ≈ 2*T - A[i]
 *
 * OPTIMIZED: Pre-compute ideal B colors and use voting to select best candidates.
 */
function selectPaletteBForCPCPlus(
  paletteA: Vector<'RGB'>[],
  targetColors: Vector<'RGB'>[],
  targetWeights: number[],
  availableColors: Vector<'RGB'>[],
  maxFlicker = 80
): Vector<'RGB'>[] {
  const selected: Vector<'RGB'>[] = []
  const usedKeys = new Set<string>()

  // CRITICAL: Copy essential colors from A to B (black, white, saturated)
  for (const color of paletteA) {
    const key = `${color[0]},${color[1]},${color[2]}`
    if (usedKeys.has(key)) continue

    const [r, g, b] = color
    const maxC = Math.max(r, g, b)
    const minC = Math.min(r, g, b)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    const isVeryDark = lum < 30
    const isVeryBright = lum > 225
    const isHighlySaturated = maxC - minC > 180 && maxC > 200

    if (isVeryDark || isVeryBright || isHighlySaturated) {
      selected.push(color)
      usedKeys.add(key)
    }
  }

  // Pre-compute: For each (target, A) pair, calculate ideal B and find nearest available
  // Then vote for candidates based on how well they cover targets
  const candidateScores = new Map<
    string,
    { color: Vector<'RGB'>; score: number }
  >()

  for (let t = 0; t < targetColors.length; t++) {
    const target = targetColors[t]
    const weight = targetWeights[t]

    for (const colorA of paletteA) {
      // Calculate ideal B: blend(A, B) = T => B = 2*T - A
      const idealB: Vector<'RGB'> = [
        Math.max(0, Math.min(255, 2 * target[0] - colorA[0])),
        Math.max(0, Math.min(255, 2 * target[1] - colorA[1])),
        Math.max(0, Math.min(255, 2 * target[2] - colorA[2]))
      ]

      // Check flicker constraint
      const lumA = 0.299 * colorA[0] + 0.587 * colorA[1] + 0.114 * colorA[2]
      const lumIdealB =
        0.299 * idealB[0] + 0.587 * idealB[1] + 0.114 * idealB[2]
      if (Math.abs(lumA - lumIdealB) > maxFlicker) continue

      // Find nearest available color to ideal B
      const nearest = findNearestColor(idealB, availableColors)
      const key = `${nearest[0]},${nearest[1]},${nearest[2]}`

      if (usedKeys.has(key)) continue

      // Calculate actual blend error
      const actualBlend: Vector<'RGB'> = [
        Math.round((colorA[0] + nearest[0]) / 2),
        Math.round((colorA[1] + nearest[1]) / 2),
        Math.round((colorA[2] + nearest[2]) / 2)
      ]
      const blendError = colorDistance(target, actualBlend)

      // Score based on how well this covers the target (lower error = higher score)
      const score = weight * Math.max(0, 10000 - blendError)

      const existing = candidateScores.get(key)
      if (existing) {
        existing.score += score
      } else {
        candidateScores.set(key, { color: nearest, score })
      }
    }
  }

  // Sort candidates by accumulated score
  const sortedCandidates = [...candidateScores.values()].sort(
    (a, b) => b.score - a.score
  )

  // Select top candidates with diversity constraint
  const MIN_DIVERSITY = 150
  for (const candidate of sortedCandidates) {
    if (selected.length >= 16) break

    const key = `${candidate.color[0]},${candidate.color[1]},${candidate.color[2]}`
    if (usedKeys.has(key)) continue

    if (
      selected.length === 0 ||
      isColorDiverse(candidate.color, selected, MIN_DIVERSITY)
    ) {
      selected.push(candidate.color)
      usedKeys.add(key)
    }
  }

  // Relax diversity if needed
  for (const candidate of sortedCandidates) {
    if (selected.length >= 16) break

    const key = `${candidate.color[0]},${candidate.color[1]},${candidate.color[2]}`
    if (!usedKeys.has(key)) {
      selected.push(candidate.color)
      usedKeys.add(key)
    }
  }

  // Pad to 16 if needed
  while (selected.length < 16) {
    selected.push([0, 0, 0])
  }

  const paletteAKeys = new Set(paletteA.map((c) => `${c[0]},${c[1]},${c[2]}`))
  logger.info('[Mode R] CPC Plus Palette B selection (blend-optimized)', {
    numSelected: selected.length,
    sharedWithA: selected.filter((c) =>
      paletteAKeys.has(`${c[0]},${c[1]},${c[2]}`)
    ).length,
    candidatesEvaluated: candidateScores.size
  })

  return selected
}

/**
 * CPC Classic strategy for palette B:
 * Use ideal blend calculation since the 27-color palette is limited.
 */
function selectPaletteBForCPCClassic(
  paletteA: Vector<'RGB'>[],
  targetColors: Vector<'RGB'>[],
  targetWeights: number[],
  availableColors: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  const selected: Vector<'RGB'>[] = []
  const usedKeys = new Set<string>()

  // Start with top 4 colors from palette A (ensures some pure/no-flicker options)
  const NUM_SHARED_COLORS = 4
  for (let i = 0; i < Math.min(NUM_SHARED_COLORS, paletteA.length); i++) {
    const color = paletteA[i]
    const key = `${color[0]},${color[1]},${color[2]}`
    if (!usedKeys.has(key)) {
      selected.push(color)
      usedKeys.add(key)
    }
  }

  // For each target color, calculate the ideal B color for each A color
  const candidateVotes = new Map<
    string,
    { color: Vector<'RGB'>; score: number }
  >()

  for (let t = 0; t < targetColors.length; t++) {
    const target = targetColors[t]
    const weight = targetWeights[t]

    for (const colorA of paletteA) {
      // blend(A, B) = target → B = 2*target - A
      const idealB: Vector<'RGB'> = [
        Math.max(0, Math.min(255, 2 * target[0] - colorA[0])),
        Math.max(0, Math.min(255, 2 * target[1] - colorA[1])),
        Math.max(0, Math.min(255, 2 * target[2] - colorA[2]))
      ]

      const nearest = findNearestColor(idealB, availableColors)
      const key = `${nearest[0]},${nearest[1]},${nearest[2]}`

      if (usedKeys.has(key)) continue

      const idealDistance = colorDistance(idealB, nearest)
      const score = weight * Math.max(0, 1 - idealDistance / 10000)

      const existing = candidateVotes.get(key)
      if (existing) {
        existing.score += score
      } else {
        candidateVotes.set(key, { color: nearest, score })
      }
    }
  }

  const sortedCandidates = [...candidateVotes.values()].sort(
    (a, b) => b.score - a.score
  )

  // Select with diversity constraint
  const MIN_DIVERSITY = 1000
  for (const candidate of sortedCandidates) {
    if (selected.length >= 16) break

    const key = `${candidate.color[0]},${candidate.color[1]},${candidate.color[2]}`
    if (usedKeys.has(key)) continue

    if (isColorDiverse(candidate.color, selected, MIN_DIVERSITY)) {
      selected.push(candidate.color)
      usedKeys.add(key)
    }
  }

  // Relax and fill
  for (const candidate of sortedCandidates) {
    if (selected.length >= 16) break

    const key = `${candidate.color[0]},${candidate.color[1]},${candidate.color[2]}`
    if (!usedKeys.has(key)) {
      selected.push(candidate.color)
      usedKeys.add(key)
    }
  }

  if (selected.length < 16) {
    fillWithDiverseColors(selected, usedKeys, availableColors, 16, 500)
  }

  logger.info('[Mode R] CPC Classic Palette B selection', {
    numSelected: selected.length
  })

  return selected
}

/**
 * Create two independent palettes of 16 colors each that maximize
 * the coverage of target colors through their blends.
 *
 * Strategy:
 * 1. Palette A: Select 16 colors optimized for blend coverage
 * 2. Palette B: Same as A (single palette) or optimized complement (dual palette)
 *
 * With 16×16 = 256 possible blend combinations, Mode R can represent
 * far more perceived colors than standard Mode 0's 16 colors.
 */
export function optimizeModeRPalettes(
  targetColors: Vector<'RGB'>[],
  targetWeights: number[] | undefined,
  config: ModeRConfig = DEFAULT_MODE_R_CONFIG,
  _existingPalette?: Vector<'RGB'>[] // No longer used - always optimize for blends
): ModeRPalettes {
  // Generate uniform weights if not provided
  const weights =
    targetWeights && targetWeights.length === targetColors.length
      ? targetWeights
      : targetColors.map(() => 1 / targetColors.length)

  // Get available hardware colors
  const availableColors =
    config.targetHardware === 'plus'
      ? generateCPCPlusPalette()
      : generateCPCClassicPalette()

  logger.info('[Mode R] Starting palette optimization', {
    hardware: config.targetHardware,
    availableColors: availableColors.length,
    targetColors: targetColors.length,
    useDualPalette: config.useDualPalette
  })

  let paletteA: Vector<'RGB'>[]

  // Mode R ALWAYS needs a palette optimized for blending
  // The existing palette from standard mode is optimized for direct colors,
  // not for producing good blends. So we always recompute.
  paletteA = selectPaletteForBlends(
    targetColors,
    weights,
    availableColors,
    16,
    config.maxLuminanceDelta
  )
  logger.info('[Mode R] Computed palette A optimized for blends', {
    colors: paletteA.length,
    hardware: config.targetHardware
  })

  // Select palette B based on dual palette option
  let paletteB: Vector<'RGB'>[]
  if (config.useDualPalette) {
    // Dual palette mode: optimize B to maximize blend coverage of target colors
    paletteB = selectOptimizedPaletteB(
      paletteA,
      targetColors,
      weights,
      availableColors,
      config
    )
    logger.info('[Mode R] Using dual palette mode (optimized palette B)')
  } else {
    // Single palette mode: use same palette for both frames (no flicker from palette)
    paletteB = [...paletteA]
    logger.info(
      '[Mode R] Using single palette mode (same palette for both frames)'
    )
  }

  // Pad palettes to 16 if needed (with black for potential margins)
  while (paletteA.length < 16) paletteA.push([0, 0, 0])
  while (paletteB.length < 16) paletteB.push([0, 0, 0])

  // Ensure black is present in both palettes for margin handling
  // Margins are typically filled with black and need a uniform pair to avoid flicker
  const hasBlackInA = paletteA.some(
    (c) => c[0] <= 17 && c[1] <= 17 && c[2] <= 17
  )
  const hasBlackInB = paletteB.some(
    (c) => c[0] <= 17 && c[1] <= 17 && c[2] <= 17
  )

  if (!hasBlackInA) {
    // Replace the last color with black
    paletteA[15] = [0, 0, 0]
    logger.info('[Mode R] Added black to palette A for margin handling')
  }
  if (!hasBlackInB) {
    // Replace the last color with black
    paletteB[15] = [0, 0, 0]
    logger.info('[Mode R] Added black to palette B for margin handling')
  }

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
