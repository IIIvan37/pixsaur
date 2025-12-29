/**
 * Mode R Pair Optimizer
 *
 * Finds optimal color pairs (colorA, colorB) for each target color
 * such that:
 * 1. blend(colorA, colorB) ≈ target
 * 2. |luminance(colorA) - luminance(colorB)| is minimized (anti-flicker)
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  blendColors,
  calculateFlickerScore,
  calculatePairCost,
  colorDistance
} from './blend'
import type {
  CandidatePair,
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
 * Evaluate a color pair and return a candidate if valid
 */
function evaluatePair(
  targetColor: Vector<'RGB'>,
  colorA: Vector<'RGB'>,
  colorB: Vector<'RGB'>,
  config: ModeRConfig
): CandidatePair | null {
  const flicker = calculateFlickerScore(colorA, colorB)

  // Skip pairs with too much luminance difference
  if (flicker > config.maxLuminanceDelta) {
    return null
  }

  const blended = blendColors(colorA, colorB)
  const cost = calculatePairCost(
    targetColor,
    colorA,
    colorB,
    config.antiFlickerWeight
  )

  return {
    colorA,
    colorB,
    blendedColor: blended,
    flickerScore: flicker,
    cost
  }
}

/**
 * Search for best pair among a set of colors
 */
function searchBestPair(
  targetColor: Vector<'RGB'>,
  colors: Vector<'RGB'>[],
  config: ModeRConfig
): CandidatePair | null {
  let bestPair: CandidatePair | null = null
  let bestCost = Number.POSITIVE_INFINITY

  for (const colorA of colors) {
    for (const colorB of colors) {
      const pair = evaluatePair(targetColor, colorA, colorB, config)
      if (pair && pair.cost < bestCost) {
        bestCost = pair.cost
        bestPair = pair
      }
    }
  }

  return bestPair
}

/**
 * Find the best pair for a single target color
 *
 * @param targetColor - The color to match
 * @param availableColors - Available hardware colors
 * @param config - Mode R configuration
 * @returns Best candidate pair
 */
export function findBestPairForColor(
  targetColor: Vector<'RGB'>,
  availableColors: Vector<'RGB'>[],
  config: ModeRConfig = DEFAULT_MODE_R_CONFIG
): CandidatePair {
  // For CPC Plus, search among nearby colors only (4096 total is too many)
  const searchColors =
    config.targetHardware === 'plus'
      ? findNearbyColors(targetColor, availableColors, 64)
      : availableColors

  const bestPair = searchBestPair(targetColor, searchColors, config)

  // Fallback: if no valid pair found, use the same color for both
  if (!bestPair) {
    const nearestColor = findNearestColor(targetColor, availableColors)
    return {
      colorA: nearestColor,
      colorB: nearestColor,
      blendedColor: nearestColor,
      flickerScore: 0,
      cost: colorDistance(targetColor, nearestColor)
    }
  }

  return bestPair
}

/**
 * Find colors near a target within the available palette
 */
function findNearbyColors(
  target: Vector<'RGB'>,
  available: Vector<'RGB'>[],
  maxCount: number
): Vector<'RGB'>[] {
  // Sort by distance and take top N
  const sorted = [...available].sort((a, b) => {
    return colorDistance(target, a) - colorDistance(target, b)
  })
  return sorted.slice(0, maxCount)
}

/**
 * Find the nearest color in the palette
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
 * Optimize 16 color pairs for a set of target colors
 *
 * @param targetColors - The 16 colors to represent (from image quantization)
 * @param config - Mode R configuration
 * @returns Optimized Mode R palettes
 */
export function optimizeModeRPalettes(
  targetColors: Vector<'RGB'>[],
  config: ModeRConfig = DEFAULT_MODE_R_CONFIG
): ModeRPalettes {
  if (targetColors.length > 16) {
    throw new Error('Mode R supports maximum 16 color pairs')
  }

  // Get available hardware colors
  const availableColors =
    config.targetHardware === 'plus'
      ? generateCPCPlusPalette()
      : generateCPCClassicPalette()

  // Find best pair for each target color
  const pairs: ModeRColorPair[] = []
  const paletteA: Vector<'RGB'>[] = []
  const paletteB: Vector<'RGB'>[] = []

  for (let i = 0; i < targetColors.length; i++) {
    const target = targetColors[i]
    const bestPair = findBestPairForColor(target, availableColors, config)

    pairs.push({
      index: i,
      colorA: bestPair.colorA,
      colorB: bestPair.colorB,
      blendedColor: bestPair.blendedColor,
      flickerScore: bestPair.flickerScore
    })

    paletteA.push(bestPair.colorA)
    paletteB.push(bestPair.colorB)
  }

  // Pad to 16 colors if needed (use black for unused slots)
  while (pairs.length < 16) {
    const black: Vector<'RGB'> = [0, 0, 0]
    pairs.push({
      index: pairs.length,
      colorA: black,
      colorB: black,
      blendedColor: black,
      flickerScore: 0
    })
    paletteA.push(black)
    paletteB.push(black)
  }

  // Calculate statistics
  const stats = calculatePaletteStats(pairs)

  return { paletteA, paletteB, pairs, stats }
}

/**
 * Calculate statistics for a Mode R palette
 */
function calculatePaletteStats(pairs: ModeRColorPair[]): ModeRPaletteStats {
  const flickerScores = pairs.map((p) => p.flickerScore)
  const averageFlicker = flickerScores.reduce((a, b) => a + b, 0) / pairs.length
  const maxFlicker = Math.max(...flickerScores)
  const noFlickerPairs = flickerScores.filter((f) => f === 0).length

  // Count unique perceived colors
  const uniqueColors = new Set(
    pairs.map(
      (p) => `${p.blendedColor[0]},${p.blendedColor[1]},${p.blendedColor[2]}`
    )
  )

  return {
    averageFlicker,
    maxFlicker,
    noFlickerPairs,
    uniquePerceivedColors: uniqueColors.size
  }
}

/**
 * Pre-compute all valid pairs for CPC Classic (729 pairs)
 * This can be cached for faster repeated use
 */
export function precomputeClassicPairs(
  maxLuminanceDelta: number
): Map<string, CandidatePair[]> {
  const palette = generateCPCClassicPalette()
  const pairsByBlend = new Map<string, CandidatePair[]>()

  for (const colorA of palette) {
    for (const colorB of palette) {
      const blended = blendColors(colorA, colorB)
      const flicker = calculateFlickerScore(colorA, colorB)

      if (flicker > maxLuminanceDelta) continue

      const key = `${blended[0]},${blended[1]},${blended[2]}`
      const pair: CandidatePair = {
        colorA,
        colorB,
        blendedColor: blended,
        flickerScore: flicker,
        cost: 0 // Will be calculated per target
      }

      if (!pairsByBlend.has(key)) {
        pairsByBlend.set(key, [])
      }
      pairsByBlend.get(key)!.push(pair)
    }
  }

  return pairsByBlend
}
