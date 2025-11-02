/**
 * Stratégies de sélection de palette v2 - Avec contraste intégré
 * Remplace les anciennes stratégies en intégrant directement les modes balanced/max
 */

import { weightedRGBDistance } from '../metric/distance'
import type { Vector } from '../type'
import { luminance as calculateLuminance } from './select-contrast-subset'

export interface ColorCandidate {
  index: number
  frequency: number
  color: Vector
  converted: Vector
}

export interface StrategyResult {
  selectedIndices: number[]
  scores?: Map<number, number>
}

/**
 * Interface commune pour toutes les fonctions de stratégie de palette
 */
export type PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices?: number[]
) => StrategyResult

function calculatePerceptualDistance(color1: Vector, color2: Vector): number {
  return Math.sqrt(weightedRGBDistance(color1, color2))
}

/**
 * Calcule la saturation d'une couleur (0-1)
 * Saturation = (Max - Min) / Max (si Max > 0)
 */
function calculateSaturation(color: Vector): number {
  const r = color[0] / 255
  const g = color[1] / 255
  const b = color[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max > 0 ? (max - min) / max : 0
}

// ============================================================================
// FREQUENCY STRATEGIES
// ============================================================================

/**
 * frequency-balanced : Fréquence prioritaire (80%) avec diversité modérée
 */
export const selectByFrequencyBalanced: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  return selectByFrequencyCore(candidates, targetColors, preselectedIndices, 60)
}

/**
 * frequency-max : Équilibre fréquence/diversité (60%/40%)
 */
export const selectByFrequencyMax: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  return selectByFrequencyCore(candidates, targetColors, preselectedIndices, 40)
}

function selectByFrequencyCore(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[],
  minDistance: number
): StrategyResult {
  const result = [...preselectedIndices]
  const selectedConverted: Vector[] = result.map(
    (idx) =>
      candidates.find((c) => c.index === idx)?.converted ||
      ([0, 0, 0] as Vector)
  )

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors) }
  }

  const sorted = [...candidates].sort((a, b) => b.frequency - a.frequency)

  for (const candidate of sorted) {
    if (result.includes(candidate.index)) continue
    if (result.length >= targetColors) break

    let isDiverse = true
    for (const selectedColor of selectedConverted) {
      if (
        calculatePerceptualDistance(candidate.converted, selectedColor) <
        minDistance
      ) {
        isDiverse = false
        break
      }
    }

    if (isDiverse) {
      result.push(candidate.index)
      selectedConverted.push(candidate.converted)
    }
  }

  // Compléter si nécessaire
  for (const candidate of sorted) {
    if (result.length >= targetColors) break
    if (!result.includes(candidate.index)) {
      result.push(candidate.index)
    }
  }

  return { selectedIndices: result }
}

// ============================================================================
// BALANCED-SCORE STRATEGIES
// ============================================================================

/**
 * balanced-score-balanced : Fréquence dominante (50% freq, 25% div, 25% lum)
 */
export const selectByBalancedScoreBalanced: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  return selectByBalancedScoreCore(
    candidates,
    targetColors,
    preselectedIndices,
    { frequency: 0.5, diversity: 0.25, luminance: 0.25 }
  )
}

/**
 * balanced-score-max : Contraste prioritaire (30% freq, 35% div, 35% lum)
 */
export const selectByBalancedScoreMax: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  return selectByBalancedScoreCore(
    candidates,
    targetColors,
    preselectedIndices,
    { frequency: 0.3, diversity: 0.35, luminance: 0.35 }
  )
}

function selectByBalancedScoreCore(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[],
  weights: { frequency: number; diversity: number; luminance: number }
): StrategyResult {
  const result = [...preselectedIndices]
  const scores = new Map<number, number>()

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  const maxFreq = Math.max(...candidates.map((c) => c.frequency))
  const luminances = candidates.map((c) => ({
    index: c.index,
    luminance: calculateLuminance(c.color)
  }))

  if (result.length === 0 && candidates.length > 0) {
    const first = candidates.reduce((prev, curr) =>
      curr.frequency > prev.frequency ? curr : prev
    )
    result.push(first.index)
  }

  while (result.length < targetColors && candidates.length > 0) {
    let bestScore = -Infinity
    let bestCandidate: ColorCandidate | null = null

    for (const candidate of candidates) {
      if (result.includes(candidate.index)) continue

      const freqScore = candidate.frequency / maxFreq

      const selectedColors = result.map(
        (idx) => candidates.find((c) => c.index === idx)!.converted
      )
      let minColorDist = Infinity
      for (const selected of selectedColors) {
        const dist = calculatePerceptualDistance(candidate.converted, selected)
        minColorDist = Math.min(minColorDist, dist)
      }
      const diversityScore = Math.min(1, minColorDist / 255)

      const candidateLum = calculateLuminance(candidate.color)
      const selectedLuminances = result.map(
        (idx) => luminances.find((l) => l.index === idx)!.luminance
      )
      let minLumDist = Infinity
      for (const selectedLum of selectedLuminances) {
        const dist = Math.abs(candidateLum - selectedLum)
        minLumDist = Math.min(minLumDist, dist)
      }
      const luminanceScore = minLumDist

      const hasDark = selectedLuminances.some((l) => l < 0.3)
      const hasBright = selectedLuminances.some((l) => l > 0.7)
      let balanceBonus = 0
      if (!hasDark && candidateLum < 0.3) balanceBonus = 0.2
      if (!hasBright && candidateLum > 0.7) balanceBonus = 0.2

      const totalScore =
        freqScore * weights.frequency +
        diversityScore * weights.diversity +
        luminanceScore * weights.luminance +
        balanceBonus

      if (totalScore > bestScore) {
        bestScore = totalScore
        bestCandidate = candidate
      }
    }

    if (bestCandidate) {
      result.push(bestCandidate.index)
      scores.set(bestCandidate.index, bestScore)
    } else {
      const remaining = candidates.filter((c) => !result.includes(c.index))
      if (remaining.length > 0) {
        const fallback = remaining.reduce((prev, curr) =>
          curr.frequency > prev.frequency ? curr : prev
        )
        result.push(fallback.index)
      }
      break
    }
  }

  return { selectedIndices: result, scores }
}

// ============================================================================
// PERCEPTUAL STRATEGIES
// ============================================================================

/**
 * perceptual-balanced : Luminance bins avec fréquence prioritaire
 */
export const selectByPerceptualBalanced: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  return selectByPerceptualCore(
    candidates,
    targetColors,
    preselectedIndices,
    true
  )
}

/**
 * perceptual-max : Luminance bins avec diversité prioritaire
 */
export const selectByPerceptualMax: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  return selectByPerceptualCore(
    candidates,
    targetColors,
    preselectedIndices,
    false
  )
}

function selectByPerceptualCore(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[],
  prioritizeFrequency: boolean
): StrategyResult {
  const result = [...preselectedIndices]

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors) }
  }

  const withLuminance = candidates.map((c) => ({
    ...c,
    luminance: calculateLuminance(c.color)
  }))

  withLuminance.sort((a, b) => b.frequency - a.frequency)

  const numBins = Math.min(targetColors, 4)
  const binSize = 1.0 / numBins

  for (let bin = 0; bin < numBins && result.length < targetColors; bin++) {
    const minLum = bin * binSize
    const maxLum = (bin + 1) * binSize

    const inBin = withLuminance.filter(
      (c) =>
        c.luminance >= minLum &&
        c.luminance < maxLum &&
        !result.includes(c.index)
    )

    if (inBin.length > 0) {
      if (prioritizeFrequency) {
        // Balanced: prendre la plus fréquente
        result.push(inBin[0].index)
      } else {
        // Max: prendre la plus diverse
        let bestCandidate = inBin[0]
        if (result.length > 0) {
          let maxMinDist = -Infinity
          for (const candidate of inBin) {
            const selectedColors = result.map(
              (idx) => candidates.find((c) => c.index === idx)!.converted
            )
            let minDist = Infinity
            for (const selected of selectedColors) {
              const dist = calculatePerceptualDistance(
                candidate.converted,
                selected
              )
              minDist = Math.min(minDist, dist)
            }
            if (minDist > maxMinDist) {
              maxMinDist = minDist
              bestCandidate = candidate
            }
          }
        }
        result.push(bestCandidate.index)
      }
    }
  }

  // Compléter avec les plus fréquentes restantes
  for (const candidate of withLuminance) {
    if (result.length >= targetColors) break
    if (!result.includes(candidate.index)) {
      result.push(candidate.index)
    }
  }

  return { selectedIndices: result }
}

// ============================================================================
// DIVERSITY-FIRST STRATEGIES
// ============================================================================

/**
 * diversity-first-balanced : Diversité dominante avec légère fréquence (90%/10%)
 */
export const selectByDiversityFirstBalanced: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  return selectByDiversityFirstCore(
    candidates,
    targetColors,
    preselectedIndices,
    0.1
  )
}

/**
 * diversity-first-max : Diversité pure (100% diversité, 0% fréquence)
 */
export const selectByDiversityFirstMax: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  return selectByDiversityFirstCore(
    candidates,
    targetColors,
    preselectedIndices,
    0.0
  )
}

function selectByDiversityFirstCore(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[],
  frequencyWeight: number
): StrategyResult {
  const result = [...preselectedIndices]
  const scores = new Map<number, number>()

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  if (result.length === 0 && candidates.length > 0) {
    const first = candidates.reduce((prev, curr) =>
      curr.frequency > prev.frequency ? curr : prev
    )
    result.push(first.index)
  }

  const isCPCClassic = candidates.length <= 27
  const MIN_COLOR_DISTANCE = isCPCClassic ? 50 : 140
  const MIN_LUMINANCE_DISTANCE = isCPCClassic ? 0.15 : 0.35

  while (result.length < targetColors && candidates.length > 0) {
    let bestScore = -Infinity
    let bestCandidate: ColorCandidate | null = null

    const selectedColors = result.map(
      (idx) => candidates.find((c) => c.index === idx)!.converted
    )
    const selectedLuminances = result.map((idx) =>
      calculateLuminance(candidates.find((c) => c.index === idx)!.color)
    )

    const maxFreq =
      frequencyWeight > 0 ? Math.max(...candidates.map((c) => c.frequency)) : 1

    for (const candidate of candidates) {
      if (result.includes(candidate.index)) continue

      let minColorDist = Infinity
      for (const selected of selectedColors) {
        const dist = calculatePerceptualDistance(candidate.converted, selected)
        minColorDist = Math.min(minColorDist, dist)
      }

      if (minColorDist < MIN_COLOR_DISTANCE) continue

      const diversityScore = Math.min(1, minColorDist / 255)

      const candidateLum = calculateLuminance(candidate.color)
      let minLumDist = Infinity
      for (const selectedLum of selectedLuminances) {
        const dist = Math.abs(candidateLum - selectedLum)
        minLumDist = Math.min(minLumDist, dist)
      }

      if (minLumDist < MIN_LUMINANCE_DISTANCE) continue

      const luminanceScore = minLumDist

      const hasDark = selectedLuminances.some((l) => l < 0.25)
      const hasBright = selectedLuminances.some((l) => l > 0.75)
      const hasMid = selectedLuminances.some((l) => l >= 0.4 && l <= 0.6)

      let balanceBonus = 0
      if (!hasDark && candidateLum < 0.25) balanceBonus = 0.5
      if (!hasBright && candidateLum > 0.75) balanceBonus = 0.5
      if (!hasMid && candidateLum >= 0.4 && candidateLum <= 0.6)
        balanceBonus = 0.3

      // Bonus saturation pour CPC Plus : favoriser les couleurs saturées
      const saturationBonus = !isCPCClassic
        ? calculateSaturation(candidate.color) * 0.3
        : 0

      const freqScore = frequencyWeight > 0 ? candidate.frequency / maxFreq : 0

      const totalScore =
        diversityScore * (0.7 - frequencyWeight) +
        luminanceScore * 0.3 +
        freqScore * frequencyWeight +
        balanceBonus +
        saturationBonus

      if (totalScore > bestScore) {
        bestScore = totalScore
        bestCandidate = candidate
      }
    }

    if (bestCandidate) {
      result.push(bestCandidate.index)
      scores.set(bestCandidate.index, bestScore)
    } else {
      // Fallback progressif
      let relaxFactor = 0.7
      let foundCandidate = false

      while (!foundCandidate && relaxFactor > 0.2) {
        const relaxedMinColorDist = MIN_COLOR_DISTANCE * relaxFactor
        const relaxedMinLumDist = MIN_LUMINANCE_DISTANCE * relaxFactor

        for (const candidate of candidates) {
          if (result.includes(candidate.index)) continue

          let minColorDist = Infinity
          for (const selected of selectedColors) {
            const dist = calculatePerceptualDistance(
              candidate.converted,
              selected
            )
            minColorDist = Math.min(minColorDist, dist)
          }

          if (minColorDist < relaxedMinColorDist) continue

          const candidateLum = calculateLuminance(candidate.color)
          let minLumDist = Infinity
          for (const selectedLum of selectedLuminances) {
            minLumDist = Math.min(
              minLumDist,
              Math.abs(candidateLum - selectedLum)
            )
          }

          if (minLumDist < relaxedMinLumDist) continue

          const diversityScore = Math.min(1, minColorDist / 255)
          const totalScore = diversityScore * 0.7 + minLumDist * 0.3

          if (totalScore > bestScore) {
            bestScore = totalScore
            bestCandidate = candidate
            foundCandidate = true
          }
        }

        if (!foundCandidate) {
          relaxFactor -= 0.15
        }
      }

      if (bestCandidate) {
        result.push(bestCandidate.index)
        scores.set(bestCandidate.index, bestScore)
      } else {
        // Dernier recours : la plus diverse sans contrainte
        let maxDiversity = -Infinity
        for (const candidate of candidates) {
          if (result.includes(candidate.index)) continue

          let minColorDist = Infinity
          for (const selected of selectedColors) {
            const dist = calculatePerceptualDistance(
              candidate.converted,
              selected
            )
            minColorDist = Math.min(minColorDist, dist)
          }

          if (minColorDist > maxDiversity) {
            maxDiversity = minColorDist
            bestCandidate = candidate
          }
        }

        if (bestCandidate) {
          result.push(bestCandidate.index)
          scores.set(bestCandidate.index, 0)
        } else {
          break
        }
      }
    }
  }

  return { selectedIndices: result, scores }
}

// ============================================================================
// ADAPTIVE STRATEGY
// ============================================================================

/**
 * adaptive : Choix dynamique selon l'image
 */
export const selectByAdaptive: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  // TODO: Analyser l'image pour choisir la meilleure stratégie
  // Pour l'instant, utiliser balanced-score-balanced
  return selectByBalancedScoreBalanced(
    candidates,
    targetColors,
    preselectedIndices
  )
}
