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

/**
 * Complète le résultat avec les candidats restants les plus fréquents
 */
function fillRemainingSlots(
  result: number[],
  candidates: ColorCandidate[],
  targetColors: number
): void {
  const sorted = [...candidates].sort((a, b) => b.frequency - a.frequency)
  for (const candidate of sorted) {
    if (result.length >= targetColors) break
    if (!result.includes(candidate.index)) {
      result.push(candidate.index)
    }
  }
}

/**
 * Sélectionne le candidat avec le score de diversité le plus élevé
 */
function selectMostDiverseCandidate(
  candidates: ColorCandidate[],
  selectedColors: Vector[],
  excludedIndices: Set<number>
): ColorCandidate | null {
  let maxMinDist = -Infinity
  let bestCandidate: ColorCandidate | null = null

  for (const candidate of candidates) {
    if (excludedIndices.has(candidate.index)) continue

    let minDist = Infinity
    for (const selected of selectedColors) {
      const dist = calculatePerceptualDistance(candidate.converted, selected)
      minDist = Math.min(minDist, dist)
    }

    if (minDist > maxMinDist) {
      maxMinDist = minDist
      bestCandidate = candidate
    }
  }

  return bestCandidate
}

/**
 * Calcule la distance de couleur minimale entre un candidat et les couleurs sélectionnées
 */
function calculateMinColorDistance(
  candidate: ColorCandidate,
  selectedColors: Vector[]
): number {
  let minDist = Infinity
  for (const selected of selectedColors) {
    const dist = calculatePerceptualDistance(candidate.converted, selected)
    minDist = Math.min(minDist, dist)
  }
  return minDist
}

/**
 * Calcule la distance de luminance minimale entre un candidat et les luminances sélectionnées
 */
function calculateMinLuminanceDistance(
  candidate: ColorCandidate,
  selectedLuminances: number[]
): number {
  const candidateLum = calculateLuminance(candidate.color)
  let minDist = Infinity
  for (const selectedLum of selectedLuminances) {
    const dist = Math.abs(candidateLum - selectedLum)
    minDist = Math.min(minDist, dist)
  }
  return minDist
}

/**
 * Calcule le bonus de balance basé sur les luminances déjà sélectionnées
 */
function calculateLuminanceBalanceBonus(
  candidateLum: number,
  selectedLuminances: number[]
): number {
  const hasDark = selectedLuminances.some((l) => l < 0.25)
  const hasBright = selectedLuminances.some((l) => l > 0.75)
  const hasMid = selectedLuminances.some((l) => l >= 0.4 && l <= 0.6)

  if (!hasDark && candidateLum < 0.25) return 0.5
  if (!hasBright && candidateLum > 0.75) return 0.5
  if (!hasMid && candidateLum >= 0.4 && candidateLum <= 0.6) return 0.3

  return 0
}

/**
 * Calcule le score équilibré d'un candidat pour la stratégie balanced-score
 */
function calculateBalancedScore(
  candidate: ColorCandidate,
  selectedColors: Vector[],
  selectedLuminances: number[],
  maxFreq: number,
  weights: { frequency: number; diversity: number; luminance: number }
): number {
  const freqScore = candidate.frequency / maxFreq

  const minColorDist = calculateMinColorDistance(candidate, selectedColors)
  const diversityScore = Math.min(1, minColorDist / 255)

  const candidateLum = calculateLuminance(candidate.color)
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

  return (
    freqScore * weights.frequency +
    diversityScore * weights.diversity +
    luminanceScore * weights.luminance +
    balanceBonus
  )
}

interface DiversityScoreParams {
  candidate: ColorCandidate
  selectedColors: Vector[]
  selectedLuminances: number[]
  frequencyWeight: number
  maxFreq: number
  isCPCClassic: boolean
  minColorDistance: number
  minLuminanceDistance: number
}

/**
 * Calcule le score de diversité pour la stratégie diversity-first
 */
function calculateDiversityScore(params: DiversityScoreParams): number | null {
  const minColorDist = calculateMinColorDistance(
    params.candidate,
    params.selectedColors
  )
  if (minColorDist < params.minColorDistance) return null

  const diversityScore = Math.min(1, minColorDist / 255)

  const candidateLum = calculateLuminance(params.candidate.color)
  const minLumDist = calculateMinLuminanceDistance(
    params.candidate,
    params.selectedLuminances
  )

  if (minLumDist < params.minLuminanceDistance) return null

  const luminanceScore = minLumDist

  const balanceBonus = calculateLuminanceBalanceBonus(
    candidateLum,
    params.selectedLuminances
  )

  const saturationBonus = params.isCPCClassic
    ? 0
    : calculateSaturation(params.candidate.color) * 0.3

  const freqScore =
    params.frequencyWeight > 0 ? params.candidate.frequency / params.maxFreq : 0

  return (
    diversityScore * (0.7 - params.frequencyWeight) +
    luminanceScore * 0.3 +
    freqScore * params.frequencyWeight +
    balanceBonus +
    saturationBonus
  )
}

/**
 * Vérifie si un candidat satisfait les critères de distance minimale
 */
function meetsDistanceCriteria(
  candidate: ColorCandidate,
  selectedColors: Vector[],
  selectedLuminances: number[],
  minColorDist: number,
  minLumDist: number
): boolean {
  const colorDist = calculateMinColorDistance(candidate, selectedColors)
  if (colorDist < minColorDist) return false

  const lumDist = calculateMinLuminanceDistance(candidate, selectedLuminances)
  return lumDist >= minLumDist
}

/**
 * Calcule le score d'un candidat pour la sélection relaxée
 */
function calculateRelaxedScore(
  candidate: ColorCandidate,
  selectedColors: Vector[]
): number {
  const minColorDist = calculateMinColorDistance(candidate, selectedColors)
  const diversityScore = Math.min(1, minColorDist / 255)
  const minLumDist = calculateMinLuminanceDistance(candidate, [
    calculateLuminance(candidate.color)
  ])
  return diversityScore * 0.7 + minLumDist * 0.3
}

/**
 * Recherche le meilleur candidat avec des critères donnés
 */
function findBestCandidateWithCriteria(
  candidates: ColorCandidate[],
  result: number[],
  selectedColors: Vector[],
  selectedLuminances: number[],
  minColorDist: number,
  minLumDist: number
): { candidate: ColorCandidate; score: number } | null {
  let bestScore = -Infinity
  let bestCandidate: ColorCandidate | null = null

  for (const candidate of candidates) {
    if (result.includes(candidate.index)) continue

    if (
      !meetsDistanceCriteria(
        candidate,
        selectedColors,
        selectedLuminances,
        minColorDist,
        minLumDist
      )
    ) {
      continue
    }

    const totalScore = calculateRelaxedScore(candidate, selectedColors)

    if (totalScore > bestScore) {
      bestScore = totalScore
      bestCandidate = candidate
    }
  }

  return bestCandidate ? { candidate: bestCandidate, score: bestScore } : null
}

/**
 * Tentative de trouver un candidat avec critères assouplis (fallback progressif)
 */
function findCandidateWithRelaxedCriteria(
  candidates: ColorCandidate[],
  result: number[],
  selectedColors: Vector[],
  selectedLuminances: number[],
  MIN_COLOR_DISTANCE: number,
  MIN_LUMINANCE_DISTANCE: number
): { candidate: ColorCandidate; score: number } | null {
  let relaxFactor = 0.7

  while (relaxFactor > 0.2) {
    const relaxedMinColorDist = MIN_COLOR_DISTANCE * relaxFactor
    const relaxedMinLumDist = MIN_LUMINANCE_DISTANCE * relaxFactor

    const foundCandidate = findBestCandidateWithCriteria(
      candidates,
      result,
      selectedColors,
      selectedLuminances,
      relaxedMinColorDist,
      relaxedMinLumDist
    )

    if (foundCandidate) return foundCandidate

    relaxFactor -= 0.15
  }

  return null
}

/**
 * Trouve le candidat le plus fréquent parmi les restants (fallback simple)
 */
function findMostFrequentRemaining(
  candidates: ColorCandidate[],
  result: number[]
): ColorCandidate | null {
  const remaining = candidates.filter((c) => !result.includes(c.index))
  if (remaining.length === 0) return null

  return remaining.reduce(
    (prev, curr) => (curr.frequency > prev.frequency ? curr : prev),
    remaining[0]
  )
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
  fillRemainingSlots(result, candidates, targetColors)

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

/**
 * Initialise la sélection avec le premier candidat (le plus fréquent)
 */
function initializeSelection(
  result: number[],
  candidates: ColorCandidate[]
): void {
  if (result.length === 0 && candidates.length > 0) {
    const first = candidates.reduce(
      (prev, curr) => (curr.frequency > prev.frequency ? curr : prev),
      candidates[0]
    )
    result.push(first.index)
  }
}

/**
 * Trouve le meilleur candidat selon le score équilibré
 */
function findBestBalancedScoreCandidate(
  candidates: ColorCandidate[],
  result: number[],
  selectedColors: Vector[],
  selectedLuminances: number[],
  maxFreq: number,
  weights: { frequency: number; diversity: number; luminance: number }
): { candidate: ColorCandidate; score: number } | null {
  let bestScore = -Infinity
  let bestCandidate: ColorCandidate | null = null

  for (const candidate of candidates) {
    if (result.includes(candidate.index)) continue

    const totalScore = calculateBalancedScore(
      candidate,
      selectedColors,
      selectedLuminances,
      maxFreq,
      weights
    )

    if (totalScore > bestScore) {
      bestScore = totalScore
      bestCandidate = candidate
    }
  }

  return bestCandidate ? { candidate: bestCandidate, score: bestScore } : null
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

  initializeSelection(result, candidates)

  while (result.length < targetColors && candidates.length > 0) {
    const selectedColors = result.map(
      (idx) => candidates.find((c) => c.index === idx)!.converted
    )
    const selectedLuminances = result.map(
      (idx) => luminances.find((l) => l.index === idx)!.luminance
    )

    const best = findBestBalancedScoreCandidate(
      candidates,
      result,
      selectedColors,
      selectedLuminances,
      maxFreq,
      weights
    )

    if (best) {
      result.push(best.candidate.index)
      scores.set(best.candidate.index, best.score)
    } else {
      const fallback = findMostFrequentRemaining(candidates, result)
      if (fallback) {
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
  const binSize = 1 / numBins

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
        const selectedColors = result.map(
          (idx) => candidates.find((c) => c.index === idx)!.converted
        )
        const excludedIndices = new Set(result)
        const bestCandidate =
          selectMostDiverseCandidate(inBin, selectedColors, excludedIndices) ||
          inBin[0]
        result.push(bestCandidate.index)
      }
    }
  }

  // Compléter avec les plus fréquentes restantes
  fillRemainingSlots(result, candidates, targetColors)

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
    0
  )
}

interface FindDiversityCandidateParams {
  candidates: ColorCandidate[]
  result: number[]
  selectedColors: Vector[]
  selectedLuminances: number[]
  frequencyWeight: number
  maxFreq: number
  isCPCClassic: boolean
  minColorDistance: number
  minLuminanceDistance: number
}

/**
 * Trouve le meilleur candidat selon le score de diversité
 */
function findBestDiversityCandidate(
  params: FindDiversityCandidateParams
): { candidate: ColorCandidate; score: number } | null {
  let bestScore = -Infinity
  let bestCandidate: ColorCandidate | null = null

  for (const candidate of params.candidates) {
    if (params.result.includes(candidate.index)) continue

    const totalScore = calculateDiversityScore({
      candidate,
      selectedColors: params.selectedColors,
      selectedLuminances: params.selectedLuminances,
      frequencyWeight: params.frequencyWeight,
      maxFreq: params.maxFreq,
      isCPCClassic: params.isCPCClassic,
      minColorDistance: params.minColorDistance,
      minLuminanceDistance: params.minLuminanceDistance
    })

    if (totalScore !== null && totalScore > bestScore) {
      bestScore = totalScore
      bestCandidate = candidate
    }
  }

  return bestCandidate ? { candidate: bestCandidate, score: bestScore } : null
}

/**
 * Essaie de trouver un candidat de fallback si aucun candidat optimal n'est trouvé
 */
function findDiversityFallbackCandidate(
  candidates: ColorCandidate[],
  result: number[],
  selectedColors: Vector[],
  selectedLuminances: number[],
  minColorDistance: number,
  minLuminanceDistance: number
): { candidate: ColorCandidate; score: number } | null {
  const relaxedResult = findCandidateWithRelaxedCriteria(
    candidates,
    result,
    selectedColors,
    selectedLuminances,
    minColorDistance,
    minLuminanceDistance
  )

  if (relaxedResult) {
    return relaxedResult
  }

  // Dernier recours : la plus diverse sans contrainte
  const excludedIndices = new Set(result)
  const bestCandidate = selectMostDiverseCandidate(
    candidates,
    selectedColors,
    excludedIndices
  )

  return bestCandidate ? { candidate: bestCandidate, score: 0 } : null
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

  initializeSelection(result, candidates)

  const isCPCClassic = candidates.length <= 27
  const MIN_COLOR_DISTANCE = isCPCClassic ? 50 : 140
  const MIN_LUMINANCE_DISTANCE = isCPCClassic ? 0.15 : 0.35

  while (result.length < targetColors && candidates.length > 0) {
    const selectedColors = result.map(
      (idx) => candidates.find((c) => c.index === idx)!.converted
    )
    const selectedLuminances = result.map((idx) =>
      calculateLuminance(candidates.find((c) => c.index === idx)!.color)
    )

    const maxFreq =
      frequencyWeight > 0 ? Math.max(...candidates.map((c) => c.frequency)) : 1

    const best = findBestDiversityCandidate({
      candidates,
      result,
      selectedColors,
      selectedLuminances,
      frequencyWeight,
      maxFreq,
      isCPCClassic,
      minColorDistance: MIN_COLOR_DISTANCE,
      minLuminanceDistance: MIN_LUMINANCE_DISTANCE
    })

    if (best) {
      result.push(best.candidate.index)
      scores.set(best.candidate.index, best.score)
    } else {
      const fallback = findDiversityFallbackCandidate(
        candidates,
        result,
        selectedColors,
        selectedLuminances,
        MIN_COLOR_DISTANCE,
        MIN_LUMINANCE_DISTANCE
      )

      if (fallback) {
        result.push(fallback.candidate.index)
        scores.set(fallback.candidate.index, fallback.score)
      } else {
        break
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
 * Analyse les caractéristiques des candidats pour choisir la meilleure stratégie
 */
export const selectByAdaptive: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult => {
  // Analyser la distribution des candidats
  const avgFrequency =
    candidates.reduce((sum, c) => sum + c.frequency, 0) / candidates.length
  const maxFrequency = Math.max(...candidates.map((c) => c.frequency))
  const frequencyVariance = maxFrequency / avgFrequency

  // Si une couleur domine fortement (variance > 3), privilégier la fréquence
  if (frequencyVariance > 3) {
    return selectByFrequencyBalanced(
      candidates,
      targetColors,
      preselectedIndices
    )
  }

  // Sinon, utiliser balanced-score pour un bon compromis
  return selectByBalancedScoreBalanced(
    candidates,
    targetColors,
    preselectedIndices
  )
}
