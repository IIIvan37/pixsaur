/**
 * Helpers for hue diversity filtering in palette strategies
 * Extracted from palette-strategies-v2.ts to reduce cognitive complexity
 */

import type { Vector } from '../type'
import {
  calculateHue,
  calculateSaturation,
  isVisuallyColorful
} from '../utils/hsv'
import type { ColorCandidate } from './palette-strategies-v2'
import { luminance as calculateLuminance } from './select-contrast-subset'

// Constants
const SATURATION_MIN_THRESHOLD = 0.15
const SATURATION_LOW_THRESHOLD = 0.01
const MIN_DISTANCE_FROM_PRESELECTED = 50
const LUMINANCE_DARK_THRESHOLD = 0.25
const LUMINANCE_BRIGHT_THRESHOLD = 0.85
const BRIGHTNESS_BONUS_HIGH = 1
const BRIGHTNESS_BONUS_LOW = 0.3
const SATURATION_SCORE_BASE = 0.7
const SATURATION_SCORE_LUMINANCE = 0.3

/**
 * Groups to categorize candidates by their visual properties
 */
export interface HueCategorizedGroups {
  /** Hue buckets: 0-60, 60-120, 120-180, 180-240, 240-300, 300-360 */
  hueGroups: ColorCandidate[][]
  /** Achromatic (gray) colors */
  grays: ColorCandidate[]
  /** Saturated but too dark colors */
  darkColors: ColorCandidate[]
}

/**
 * Calculates the perceptual distance between two colors using weighted RGB
 */
function calculatePerceptualDistanceForHelper(
  color1: Vector,
  color2: Vector
): number {
  // Simplified weighted RGB distance
  const dr = color1[0] - color2[0]
  const dg = color1[1] - color2[1]
  const db = color1[2] - color2[2]
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db)
}

/**
 * Calculates the "vividness" of a color
 * Strong priority to saturation to get vibrant colors
 */
export function calculateVividnessForColor(color: Vector): number {
  const max = Math.max(...color)
  const min = Math.min(...color)
  const saturation = max === 0 ? 0 : (max - min) / max
  const lum = calculateLuminance(color)

  // Saturation is the main factor (power of 2 to emphasize)
  // Penalize colors that are too dark or too bright
  const brightnessBonus =
    lum > LUMINANCE_DARK_THRESHOLD && lum < LUMINANCE_BRIGHT_THRESHOLD
      ? BRIGHTNESS_BONUS_HIGH
      : BRIGHTNESS_BONUS_LOW

  return (
    saturation *
    saturation *
    (SATURATION_SCORE_BASE + SATURATION_SCORE_LUMINANCE * lum) *
    brightnessBonus
  )
}

/**
 * Checks if a candidate is too close to any of the colors to avoid
 */
export function isTooCloseToColors(
  candidate: ColorCandidate,
  colorsToAvoid: readonly Vector[],
  minDistance: number = MIN_DISTANCE_FROM_PRESELECTED
): boolean {
  for (const avoidColor of colorsToAvoid) {
    const dist = calculatePerceptualDistanceForHelper(
      candidate.converted,
      avoidColor
    )
    if (dist < minDistance) return true
  }
  return false
}

/**
 * Categorizes candidates into hue groups, grays, and dark colors
 */
export function categorizeByHue(
  sortedCandidates: ColorCandidate[]
): HueCategorizedGroups {
  const hueGroups: ColorCandidate[][] = [[], [], [], [], [], []]
  const grays: ColorCandidate[] = []
  const darkColors: ColorCandidate[] = []

  for (const c of sortedCandidates) {
    if (isVisuallyColorful(c.converted)) {
      // Visually colorful (saturated AND luminous)
      const hue = calculateHue(c.converted, SATURATION_LOW_THRESHOLD)
      if (hue >= 0) {
        const groupIndex = Math.floor(hue / 60) % 6
        hueGroups[groupIndex].push(c)
      } else {
        grays.push(c)
      }
    } else {
      const sat = calculateSaturation(c.converted)
      if (sat >= SATURATION_MIN_THRESHOLD) {
        // Saturated but too dark for hue group
        darkColors.push(c)
      } else {
        // Really gray/desaturated
        grays.push(c)
      }
    }
  }

  // Sort each hue group by vividness
  for (const group of hueGroups) {
    group.sort(
      (a, b) =>
        calculateVividnessForColor(b.converted) -
        calculateVividnessForColor(a.converted)
    )
  }

  return { hueGroups, grays, darkColors }
}

/**
 * Finds the darkest eligible candidate from a list
 */
export function findDarkestCandidate(
  candidates: ColorCandidate[],
  colorsToAvoid: readonly Vector[],
  maxLuminance: number = 0.2
): ColorCandidate | null {
  const eligibleDarkCandidates = candidates.filter(
    (c) => !isTooCloseToColors(c, colorsToAvoid)
  )

  const darkest = eligibleDarkCandidates.reduce(
    (acc, current) => {
      const currentLum = calculateLuminance(current.converted)
      const darkestLum = acc ? calculateLuminance(acc.converted) : 1
      return currentLum < darkestLum ? current : acc
    },
    null as ColorCandidate | null
  )

  // Only return if sufficiently dark
  if (darkest && calculateLuminance(darkest.converted) < maxLuminance) {
    return darkest
  }
  return null
}

/**
 * Selects candidates from hue groups using round-robin strategy
 * Most vivid colors from each group are selected first
 */
export function selectByRoundRobin(
  hueGroups: ColorCandidate[][],
  maxCandidates: number,
  colorsToAvoid: readonly Vector[],
  initialSelection: ColorCandidate[] = []
): ColorCandidate[] {
  const selected = [...initialSelection]

  let added = true
  let round = 0

  while (added && selected.length < maxCandidates) {
    added = false
    for (const group of hueGroups) {
      if (selected.length >= maxCandidates) break
      if (round < group.length) {
        const c = group[round]
        const alreadySelected = selected.some((s) => s.index === c.index)
        if (!alreadySelected && !isTooCloseToColors(c, colorsToAvoid)) {
          selected.push(c)
          added = true
        }
      }
    }
    round++
  }

  return selected
}

/**
 * Selects candidates sequentially from categorized groups
 * For achromatic images with limited color diversity
 */
export function selectFromGroupsSequentially(
  categories: HueCategorizedGroups,
  maxCandidates: number,
  colorsToAvoid: readonly Vector[]
): ColorCandidate[] {
  const selected: ColorCandidate[] = []

  // First: all colors from hue groups
  for (const group of categories.hueGroups) {
    for (const c of group) {
      if (selected.length >= maxCandidates) break
      if (!isTooCloseToColors(c, colorsToAvoid)) {
        selected.push(c)
      }
    }
  }

  // Then: dark saturated colors
  for (const c of categories.darkColors) {
    if (selected.length >= maxCandidates) break
    const alreadySelected = selected.some((s) => s.index === c.index)
    if (!alreadySelected && !isTooCloseToColors(c, colorsToAvoid)) {
      selected.push(c)
    }
  }

  // Finally: grays
  for (const c of categories.grays) {
    if (selected.length >= maxCandidates) break
    const alreadySelected = selected.some((s) => s.index === c.index)
    if (!alreadySelected && !isTooCloseToColors(c, colorsToAvoid)) {
      selected.push(c)
    }
  }

  return selected
}

/**
 * Fills remaining slots with most frequent candidates
 */
export function fillWithMostFrequent(
  sortedByFrequency: ColorCandidate[],
  maxCandidates: number,
  colorsToAvoid: readonly Vector[],
  currentSelection: ColorCandidate[]
): ColorCandidate[] {
  const selected = [...currentSelection]

  for (const c of sortedByFrequency) {
    if (selected.length >= maxCandidates) break
    const alreadySelected = selected.some((s) => s.index === c.index)
    if (!alreadySelected && !isTooCloseToColors(c, colorsToAvoid)) {
      selected.push(c)
    }
  }

  return selected
}
