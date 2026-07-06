/**
 * Helpers for combination scoring and fallback selection in palette strategies
 * Extracted from palette-strategies-v2.ts to reduce cognitive complexity
 */

import type { Vector } from '../type'
import {
  calculateHue,
  calculateSaturation,
  isVisuallyColorful
} from '../utils/hsv'
import { calculateVividnessForColor } from './hue-diversity-helpers'
import type { ColorCandidate } from './palette-strategies-v2'
import { luminance as calculateLuminance } from './select-contrast-subset'

// Constants
const SATURATION_LOW_THRESHOLD = 0.01
const MIN_SATURATION_FOR_HUE = 0.2

/**
 * Result of scoring a combination of colors
 */
export interface CombinationScore {
  combo: number[]
  score: number
}

/**
 * Parameters for combination scoring
 */
export interface CombinationScoringParams {
  preselectedColors: Vector[]
  remainingCandidates: ColorCandidate[]
  isCPCClassic: boolean
  minColorfulRequired: number
}

/**
 * Calculates the total vividness of a set of colors
 * Strong priority to saturation for vibrant colors
 */
export function calculateTotalVividness(colors: Vector[]): number {
  return colors.reduce((sum, color) => {
    return sum + calculateVividnessForColor(color)
  }, 0)
}

/**
 * Calculates the average saturation of a set of colors
 * Excludes very dark and very bright colors
 */
export function calculateAverageSaturation(colors: Vector[]): number {
  const saturatedColors = colors.filter(([r, g, b]) => {
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.15 && luminance < 0.85 // Exclude black and white
  })
  if (saturatedColors.length === 0) return 0
  return (
    saturatedColors.reduce((sum, [r, g, b]) => {
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      return sum + saturation
    }, 0) / saturatedColors.length
  )
}

/**
 * Calculates the minimum distance between any two colors in a set
 * with early exit optimization
 */
export function calculateMinDistanceInSet(
  colors: Vector[],
  currentBest: number
): number {
  let minDist = Infinity
  for (let i = 0; i < colors.length - 1; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const c1 = colors[i]
      const c2 = colors[j]
      // Weighted RGB distance
      const dr = c1[0] - c2[0]
      const dg = c1[1] - c2[1]
      const db = c1[2] - c2[2]
      const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db
      if (dist < minDist) {
        minDist = dist
        // Early exit if we can't beat the current best
        if (minDist < currentBest * currentBest) {
          return Math.sqrt(minDist)
        }
      }
    }
  }
  return Math.sqrt(minDist)
}

/**
 * Calculates the minimum hue distance in a set of colors
 */
export function calculateMinHueDistanceInSet(colors: Vector[]): number {
  const hues: number[] = []
  for (const color of colors) {
    const sat = calculateSaturation(color)
    if (sat > MIN_SATURATION_FOR_HUE) {
      const hue = calculateHue(color, SATURATION_LOW_THRESHOLD)
      if (hue >= 0) {
        hues.push(hue)
      }
    }
  }

  if (hues.length < 2) return 360

  let minDist = 360
  for (let i = 0; i < hues.length - 1; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const dist = Math.min(
        Math.abs(hues[i] - hues[j]),
        360 - Math.abs(hues[i] - hues[j])
      )
      if (dist < minDist) {
        minDist = dist
      }
    }
  }
  return minDist
}

/**
 * Counts how many colors in a set are visually colorful
 */
export function countVisuallyColorful(colors: Vector[]): number {
  return colors.filter((c) => isVisuallyColorful(c)).length
}

/**
 * Calculates the enhanced score for a combination (CPC Plus mode)
 */
export function calculateEnhancedCombinationScore(
  baseScore: number,
  colors: Vector[]
): number {
  const minHueDist = calculateMinHueDistanceInSet(colors)
  const colorfulCount = countVisuallyColorful(colors)
  const totalVividness = calculateTotalVividness(colors)
  const avgSaturation = calculateAverageSaturation(colors)

  let score = baseScore

  // Bonus for good hue diversity (> 60°)
  if (minHueDist >= 60) {
    score += minHueDist * 1.5
  } else if (minHueDist >= 45) {
    score += minHueDist * 0.5
  }

  // Significant bonus for visually colorful colors
  score += colorfulCount * 30

  // Strong bonus for total vividness
  score += totalVividness * 100

  // Strong bonus for high average saturation
  score += avgSaturation * 150

  return score
}

/**
 * Checks if a combination passes the strict filters for CPC Plus
 */
export function passesCPCPlusFilters(
  colors: Vector[],
  minColorfulRequired: number
): boolean {
  // Check number of visually colorful colors
  if (minColorfulRequired > 0) {
    const colorfulCount = countVisuallyColorful(colors)
    if (colorfulCount < minColorfulRequired) {
      return false
    }
  }

  // Check minimum hue distance
  const minHueDist = calculateMinHueDistanceInSet(colors)
  if (minHueDist <= 40) {
    return false
  }

  // Check average saturation
  const avgSaturation = calculateAverageSaturation(colors)
  if (avgSaturation < 0.4) {
    return false
  }

  return true
}

/**
 * Checks if a hue is sufficiently different from all used hues
 */
export function isHueDiverse(
  hue: number,
  usedHues: number[],
  minHueDistance: number
): boolean {
  for (const usedHue of usedHues) {
    const hueDist = Math.min(
      Math.abs(hue - usedHue),
      360 - Math.abs(hue - usedHue)
    )
    if (hueDist < minHueDistance) {
      return false
    }
  }
  return true
}

/**
 * Decides whether a single candidate should be selected for hue diversity.
 * Returns whether to select it and, when it carries a usable hue, the hue to
 * remember so later candidates can be compared against it.
 */
function evaluateHueCandidate(
  candidate: ColorCandidate,
  hues: number[],
  minHueDistance: number,
  minLuminance: number
): { select: boolean; hueToAdd: number | null } {
  const rejected = { select: false, hueToAdd: null }

  // Skip very dark colors
  if (calculateLuminance(candidate.converted) < minLuminance) {
    return rejected
  }

  const saturation = calculateSaturation(candidate.converted)
  const hue = calculateHue(candidate.converted, SATURATION_LOW_THRESHOLD)
  const hasHue = saturation > MIN_SATURATION_FOR_HUE && hue >= 0

  if (hasHue && !isHueDiverse(hue, hues, minHueDistance)) {
    return rejected
  }

  return { select: true, hueToAdd: hasHue ? hue : null }
}

/**
 * Selects colors with hue diversity from sorted candidates
 * Returns the indices of selected candidates
 */
export function selectWithHueDiversity(
  candidatesWithArrayIndex: Array<{
    candidate: ColorCandidate
    arrayIndex: number
  }>,
  initialSelection: number[],
  usedHues: number[],
  neededColors: number,
  minHueDistance: number,
  minLuminance: number = 0.15
): { selectedIndices: number[]; updatedHues: number[] } {
  const selectedArrayIndices = [...initialSelection]
  const hues = [...usedHues]

  for (const { candidate, arrayIndex } of candidatesWithArrayIndex) {
    if (selectedArrayIndices.length >= neededColors) break
    if (selectedArrayIndices.includes(arrayIndex)) continue

    const { select, hueToAdd } = evaluateHueCandidate(
      candidate,
      hues,
      minHueDistance,
      minLuminance
    )
    if (!select) continue

    selectedArrayIndices.push(arrayIndex)
    if (hueToAdd !== null) {
      hues.push(hueToAdd)
    }
  }

  return { selectedIndices: selectedArrayIndices, updatedHues: hues }
}

/**
 * Finds the darkest candidate from a list
 * Returns the array index or -1 if not found
 */
export function findDarkestCandidateIndex(
  candidates: ColorCandidate[],
  maxLuminance: number = 0.15
): number {
  let darkestIdx = -1
  let darkestLum = Infinity

  for (let i = 0; i < candidates.length; i++) {
    const lum = calculateLuminance(candidates[i].converted)
    if (lum < darkestLum) {
      darkestLum = lum
      darkestIdx = i
    }
  }

  return darkestLum < maxLuminance ? darkestIdx : -1
}

/**
 * Checks if any preselected color is dark
 */
export function hasDarkPreselected(preselectedColors: Vector[]): boolean {
  return preselectedColors.some((c) => {
    const lum = calculateLuminance(c)
    return lum < 0.1
  })
}

/**
 * Gets initial hues from preselected colors
 */
export function getPreselectedHues(preselectedColors: Vector[]): number[] {
  const hues: number[] = []
  for (const preColor of preselectedColors) {
    const preHue = calculateHue(preColor, SATURATION_LOW_THRESHOLD)
    const preSat = calculateSaturation(preColor)
    if (preSat > MIN_SATURATION_FOR_HUE && preHue >= 0) {
      hues.push(preHue)
    }
  }
  return hues
}

/**
 * Sorts candidates by vividness (descending)
 */
export function sortByVividness(
  candidates: ColorCandidate[]
): Array<{ candidate: ColorCandidate; arrayIndex: number }> {
  return candidates
    .map((candidate, arrayIndex) => ({ candidate, arrayIndex }))
    .sort((a, b) => {
      const vividnessA = calculateVividnessForColor(a.candidate.converted)
      const vividnessB = calculateVividnessForColor(b.candidate.converted)
      return vividnessB - vividnessA
    })
}

/**
 * Performs intelligent fallback selection when no combination passes filters
 * Returns array indices in remainingCandidates
 */
export function selectFallbackColors(
  remainingCandidates: ColorCandidate[],
  preselectedColors: Vector[],
  neededColors: number
): number[] {
  const usedHues = getPreselectedHues(preselectedColors)
  const hasDark = hasDarkPreselected(preselectedColors)
  const candidatesWithIndex = sortByVividness(remainingCandidates)

  let selectedArrayIndices: number[] = []

  // Step 1: Add darkest color first if not already preselected
  if (!hasDark) {
    const darkestIdx = findDarkestCandidateIndex(remainingCandidates)
    if (darkestIdx >= 0) {
      selectedArrayIndices.push(darkestIdx)
    }
  }

  // Step 2: Select colors with hue diversity (strict: 45°)
  const step2 = selectWithHueDiversity(
    candidatesWithIndex,
    selectedArrayIndices,
    usedHues,
    neededColors,
    45 // MIN_HUE_DISTANCE
  )
  selectedArrayIndices = step2.selectedIndices
  let currentHues = step2.updatedHues

  // Step 3: Fallback with more permissive distance (30°)
  if (selectedArrayIndices.length < neededColors) {
    const step3 = selectWithHueDiversity(
      candidatesWithIndex,
      selectedArrayIndices,
      currentHues,
      neededColors,
      30 // FALLBACK_MIN_HUE_DISTANCE
    )
    selectedArrayIndices = step3.selectedIndices
    currentHues = step3.updatedHues
  }

  // Step 4: Last resort with very permissive distance (20°)
  if (selectedArrayIndices.length < neededColors) {
    const step4 = selectWithHueDiversity(
      candidatesWithIndex,
      selectedArrayIndices,
      currentHues,
      neededColors,
      20 // LAST_RESORT_MIN_HUE_DISTANCE
    )
    selectedArrayIndices = step4.selectedIndices
  }

  // Step 5: Ultimate fallback - take anything remaining
  if (selectedArrayIndices.length < neededColors) {
    for (const { arrayIndex } of candidatesWithIndex) {
      if (selectedArrayIndices.length >= neededColors) break
      if (!selectedArrayIndices.includes(arrayIndex)) {
        selectedArrayIndices.push(arrayIndex)
      }
    }
  }

  return selectedArrayIndices
}
