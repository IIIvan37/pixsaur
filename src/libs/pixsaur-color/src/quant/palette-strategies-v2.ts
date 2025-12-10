/**
 * Stratégies de sélection de palette v2 - Avec contraste intégré
 * Remplace les anciennes stratégies en intégrant directement les modes balanced/max
 */

import { weightedRGBDistance } from '../metric/distance'
import type { Vector } from '../type'
import {
  calculateHue,
  calculateHueDistance,
  calculateSaturation
} from '../utils/hsv'
import {
  luminance as calculateLuminance,
  isBright,
  isDark
} from './select-contrast-subset'

// ============================================================================
// CONSTANTS
// ============================================================================

// Luminance thresholds
const LUMINANCE_DARK_THRESHOLD = 0.25
const LUMINANCE_BRIGHT_THRESHOLD = 0.85
const LUMINANCE_MID_MIN = 0.4
const LUMINANCE_MID_MAX = 0.6
const LUMINANCE_VERY_DARK_THRESHOLD = 0.1
const LUMINANCE_DARK_UPPER = 0.3
const LUMINANCE_BRIGHT_LOWER = 0.7

// Saturation thresholds
const SATURATION_MIN_THRESHOLD = 0.15
const SATURATION_LOW_THRESHOLD = 0.01

// Weights and coefficients
const LUMINANCE_WEIGHT_R = 0.299
const LUMINANCE_WEIGHT_G = 0.587
const LUMINANCE_WEIGHT_B = 0.114
const BRIGHTNESS_BONUS_HIGH = 1
const BRIGHTNESS_BONUS_LOW = 0.3
const SATURATION_SCORE_BASE = 0.7
const SATURATION_SCORE_LUMINANCE = 0.3

// Distance thresholds
const MIN_DISTANCE_FROM_PRESELECTED = 50
const HUE_SIMILARITY_MAX = 180

// Palette size limits
const MAX_CANDIDATES_CLASSIC = 12
const MAX_CANDIDATES_PLUS = 16
const DARK_COUNT_CLASSIC = 2
const DARK_COUNT_PLUS = 4
const BRIGHT_COUNT_CLASSIC = 2
const BRIGHT_COUNT_PLUS = 4

// Balance and diversity
const FREQUENCY_VARIANCE_THRESHOLD = 3
const BALANCE_BONUS_MISSING_RANGE = 0.2
const BALANCE_BONUS_DARK = 0.5
const BALANCE_BONUS_BRIGHT = 0.5
const BALANCE_BONUS_MID = 0.3
const SATURATION_BONUS_WEIGHT = 0.2

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
 * Options pour les stratégies de palette
 * basePaletteSize: taille de la palette de base (27 pour CPC Classic, 4096 pour CPC Plus)
 * preselectedColors: couleurs présélectionnées (lockées) - utilisé pour éviter de sélectionner des couleurs trop proches
 */
export interface StrategyOptions {
  basePaletteSize?: number
  preselectedColors?: Vector[]
}

/**
 * Interface commune pour toutes les fonctions de stratégie de palette
 */
export type PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices?: number[],
  options?: StrategyOptions
) => StrategyResult

function calculatePerceptualDistance(color1: Vector, color2: Vector): number {
  return Math.sqrt(weightedRGBDistance(color1, color2))
}

/**
 * Détermine si on est en mode CPC Classic basé sur la taille de la palette de base
 * CPC Classic = 27 couleurs, CPC Plus = 4096 couleurs
 *
 * IMPORTANT: Ne pas utiliser candidates.length car les candidats sont préfiltrés
 * et ne reflètent pas la taille réelle de la palette hardware
 */
function isCPCClassicPalette(
  options?: StrategyOptions,
  candidatesCount?: number
): boolean {
  // Si on a l'info explicite, l'utiliser
  if (options?.basePaletteSize !== undefined) {
    return options.basePaletteSize <= 27
  }
  // Fallback: utiliser le nombre de candidats (comportement legacy, moins fiable)
  return (candidatesCount ?? 0) <= 27
}

/**
 * Calcule la "vivacité" d'une couleur
 * Priorité FORTE à la saturation pour obtenir des couleurs vibrantes
 */
function calculateVividnessForColor(color: Vector): number {
  const [r, g, b] = color
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = max === 0 ? 0 : (max - min) / max
  const luminance =
    (LUMINANCE_WEIGHT_R * r + LUMINANCE_WEIGHT_G * g + LUMINANCE_WEIGHT_B * b) /
    255

  // Saturation est le facteur principal (puissance 2 pour accentuer)
  // Pénaliser les couleurs trop sombres ou trop claires
  const brightnessBonus =
    luminance > LUMINANCE_DARK_THRESHOLD &&
    luminance < LUMINANCE_BRIGHT_THRESHOLD
      ? BRIGHTNESS_BONUS_HIGH
      : BRIGHTNESS_BONUS_LOW

  // Score = saturation² * (base + luminance_weight * luminance) * brightnessBonus
  return (
    saturation *
    saturation *
    (SATURATION_SCORE_BASE + SATURATION_SCORE_LUMINANCE * luminance) *
    brightnessBonus
  )
}

/**
 * Calcule la distance de teinte minimale entre un candidat et les couleurs sélectionnées
 * Ignore les couleurs peu saturées (gris) car leur teinte n'est pas significative
 */
function calculateMinHueDistance(
  candidate: ColorCandidate,
  selectedColors: Vector[]
): number {
  const candidateHue = calculateHue(
    candidate.converted,
    SATURATION_LOW_THRESHOLD
  )
  const candidateSat = calculateSaturation(candidate.converted)

  // Si le candidat est peu saturé, sa teinte n'est pas significative
  if (candidateSat < SATURATION_MIN_THRESHOLD) return HUE_SIMILARITY_MAX

  let minDist = HUE_SIMILARITY_MAX
  for (const selected of selectedColors) {
    const selectedSat = calculateSaturation(selected)
    // Ignorer les couleurs peu saturées dans la comparaison
    if (selectedSat < SATURATION_MIN_THRESHOLD) continue

    const selectedHue = calculateHue(selected, SATURATION_LOW_THRESHOLD)
    const dist = calculateHueDistance(candidateHue, selectedHue)
    minDist = Math.min(minDist, dist)
  }

  return minDist
}

/**
 * Filtre les candidats pour garantir une diversité de teinte
 * Pour CPC Plus, assure que les candidats sélectionnés couvrent différentes teintes
 * et ne sont pas tous des couleurs achromatiques
 * @param colorsToAvoid - Couleurs présélectionnées (lockées) à éviter (ne pas sélectionner de couleurs trop proches)
 */
function filterCandidatesWithHueDiversity(
  candidates: ColorCandidate[],
  maxCandidates: number,
  isCPCClassic: boolean,
  colorsToAvoid: Vector[] = []
): ColorCandidate[] {
  if (candidates.length <= maxCandidates) return candidates

  // Fonction pour vérifier si un candidat est trop proche d'une couleur à éviter
  const isTooCloseToAvoidedColors = (candidate: ColorCandidate): boolean => {
    for (const avoidColor of colorsToAvoid) {
      const dist = calculatePerceptualDistance(candidate.converted, avoidColor)
      if (dist < MIN_DISTANCE_FROM_PRESELECTED) return true
    }
    return false
  }

  const sorted = [...candidates].sort((a, b) => b.frequency - a.frequency)

  if (isCPCClassic) {
    // Pour CPC Classic, garder le comportement simple
    return sorted.slice(0, maxCandidates)
  }

  // Fonction pour calculer la "vivacité" d'une couleur
  // Priorité FORTE à la saturation pour obtenir des couleurs vibrantes
  const calculateVividness = (color: Vector): number => {
    const [r, g, b] = color
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    const luminance =
      (LUMINANCE_WEIGHT_R * r +
        LUMINANCE_WEIGHT_G * g +
        LUMINANCE_WEIGHT_B * b) /
      255

    // Saturation est le facteur principal (puissance 2 pour accentuer)
    // Luminance ne sert qu'à départager les couleurs très saturées
    // Pénaliser les couleurs trop sombres ou trop claires
    const brightnessBonus =
      luminance > LUMINANCE_DARK_THRESHOLD &&
      luminance < LUMINANCE_BRIGHT_THRESHOLD
        ? BRIGHTNESS_BONUS_HIGH
        : BRIGHTNESS_BONUS_LOW

    // Score = saturation² * (base + luminance_weight * luminance) * brightnessBonus
    // La saturation domine, la luminance n'ajoute qu'un petit bonus
    return (
      saturation *
      saturation *
      (SATURATION_SCORE_BASE + SATURATION_SCORE_LUMINANCE * luminance) *
      brightnessBonus
    )
  }

  // Pour CPC Plus, assurer une diversité de teinte
  const selectedCandidates: ColorCandidate[] = []

  // Grouper par plage de teinte (0-60, 60-120, 120-180, 180-240, 240-300, 300-360)
  // Ne garder que les couleurs visuellement colorées dans les groupes de teinte
  const hueGroups: ColorCandidate[][] = [[], [], [], [], [], []]
  const grays: ColorCandidate[] = []
  const darkColors: ColorCandidate[] = [] // Couleurs saturées mais trop sombres

  for (const c of sorted) {
    if (isVisuallyColorful(c.converted)) {
      // Couleur visuellement colorée (saturée ET lumineuse)
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
        // Saturée mais trop sombre ou trop claire
        darkColors.push(c)
      } else {
        // Vraiment grise
        grays.push(c)
      }
    }
  }

  // Trier chaque groupe de teinte par vivacité (les plus vives en premier)
  for (const group of hueGroups) {
    group.sort(
      (a, b) =>
        calculateVividness(b.converted) - calculateVividness(a.converted)
    )
  }

  // Compter le nombre de groupes de teintes non vides (couleurs visuellement colorées)
  const nonEmptyGroups = hueGroups.filter((g) => g.length > 0)
  const hasColorDiversity = nonEmptyGroups.length >= 2

  if (hasColorDiversity) {
    // Trouver la couleur la plus sombre parmi TOUS les candidats (pas seulement les gris)
    // pour garantir un bon contraste dans la palette finale tout en restant fidèle à l'image
    // MAIS exclure les couleurs trop proches des couleurs à éviter (présélectionnées/lockées)
    const eligibleDarkCandidates = candidates.filter(
      (c) => !isTooCloseToAvoidedColors(c)
    )
    const darkestCandidate = eligibleDarkCandidates.reduce(
      (darkest, current) => {
        const currentLum = calculateLuminance(current.converted)
        const darkestLum = darkest ? calculateLuminance(darkest.converted) : 1
        return currentLum < darkestLum ? current : darkest
      },
      null as ColorCandidate | null
    )

    // Ajouter la couleur la plus sombre en premier si elle est suffisamment sombre
    if (
      darkestCandidate &&
      calculateLuminance(darkestCandidate.converted) < 0.2
    ) {
      selectedCandidates.push(darkestCandidate)
    }

    // Ajouter des couleurs de chaque groupe de teinte en round-robin
    // Les plus vives de chaque groupe seront sélectionnées en premier
    let added = true
    let round = 0
    while (added && selectedCandidates.length < maxCandidates) {
      added = false
      for (const group of hueGroups) {
        if (selectedCandidates.length >= maxCandidates) break
        if (round < group.length) {
          const c = group[round]
          if (
            !selectedCandidates.find((s) => s.index === c.index) &&
            !isTooCloseToAvoidedColors(c)
          ) {
            selectedCandidates.push(c)
            added = true
          }
        }
      }
      round++
    }
  } else {
    // Image majoritairement achromatique - garder le comportement basé sur la fréquence
    // mais s'assurer d'inclure toutes les couleurs saturées disponibles
    for (const group of hueGroups) {
      for (const c of group) {
        if (
          selectedCandidates.length < maxCandidates &&
          !isTooCloseToAvoidedColors(c)
        ) {
          selectedCandidates.push(c)
        }
      }
    }
    // Puis compléter avec les couleurs sombres saturées
    for (const c of darkColors) {
      if (selectedCandidates.length >= maxCandidates) break
      if (
        !selectedCandidates.find((s) => s.index === c.index) &&
        !isTooCloseToAvoidedColors(c)
      ) {
        selectedCandidates.push(c)
      }
    }
    // Puis compléter avec les gris
    for (const c of grays) {
      if (selectedCandidates.length >= maxCandidates) break
      if (
        !selectedCandidates.find((s) => s.index === c.index) &&
        !isTooCloseToAvoidedColors(c)
      ) {
        selectedCandidates.push(c)
      }
    }
  }

  // Compléter avec les plus fréquents si on n'a pas assez
  for (const c of sorted) {
    if (selectedCandidates.length >= maxCandidates) break
    if (
      !selectedCandidates.find((s) => s.index === c.index) &&
      !isTooCloseToAvoidedColors(c)
    ) {
      selectedCandidates.push(c)
    }
  }

  return selectedCandidates
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
  const hasDark = selectedLuminances.some((l) => l < LUMINANCE_DARK_THRESHOLD)
  const hasBright = selectedLuminances.some((l) => l > 0.75)
  const hasMid = selectedLuminances.some(
    (l) => l >= LUMINANCE_MID_MIN && l <= LUMINANCE_MID_MAX
  )

  if (!hasDark && candidateLum < LUMINANCE_DARK_THRESHOLD)
    return BALANCE_BONUS_DARK
  if (!hasBright && candidateLum > 0.75) return BALANCE_BONUS_BRIGHT
  if (
    !hasMid &&
    candidateLum >= LUMINANCE_MID_MIN &&
    candidateLum <= LUMINANCE_MID_MAX
  )
    return BALANCE_BONUS_MID

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

  const hasDark = selectedLuminances.some((l) => l < LUMINANCE_DARK_UPPER)
  const hasBright = selectedLuminances.some((l) => l > LUMINANCE_BRIGHT_LOWER)
  let balanceBonus = 0
  if (!hasDark && candidateLum < LUMINANCE_DARK_UPPER)
    balanceBonus = BALANCE_BONUS_MISSING_RANGE
  if (!hasBright && candidateLum > LUMINANCE_BRIGHT_LOWER)
    balanceBonus = BALANCE_BONUS_MISSING_RANGE

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
  minHueDistance: number
}

/**
 * Calcule le score de diversité pour la stratégie diversity-first
 * Pour CPC Plus, inclut une vérification stricte de la distance de teinte
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

  // Pour CPC Plus, vérifier aussi la distance de teinte minimale
  if (!params.isCPCClassic && params.minHueDistance > 0) {
    const minHueDist = calculateMinHueDistance(
      params.candidate,
      params.selectedColors
    )
    if (minHueDist < params.minHueDistance) return null
  }

  const luminanceScore = minLumDist

  const balanceBonus = calculateLuminanceBalanceBonus(
    candidateLum,
    params.selectedLuminances
  )

  // Pour CPC Plus, bonus pour saturation ET diversité de teinte
  let saturationBonus = 0
  if (!params.isCPCClassic) {
    const saturation = calculateSaturation(params.candidate.color)
    const hueDistance = calculateMinHueDistance(
      params.candidate,
      params.selectedColors
    )
    // Bonus combiné saturation + teinte
    saturationBonus =
      saturation * SATURATION_BONUS_WEIGHT +
      (hueDistance / HUE_SIMILARITY_MAX) * SATURATION_BONUS_WEIGHT
  }

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
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  return selectByFrequencyCore(
    candidates,
    targetColors,
    preselectedIndices,
    60,
    options
  )
}

/**
 * frequency-max : Équilibre fréquence/diversité (60%/40%)
 */
export const selectByFrequencyMax: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  return selectByFrequencyCore(
    candidates,
    targetColors,
    preselectedIndices,
    40,
    options
  )
}

function selectByFrequencyCore(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[],
  minDistance: number,
  options?: StrategyOptions
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

  // Pour CPC Plus, ajouter une contrainte de teinte minimale
  const isCPCClassic = isCPCClassicPalette(options, candidates.length)
  const minHueDistance = isCPCClassic ? 0 : 60

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

    // Pour CPC Plus, vérifier aussi la distance de teinte
    if (isDiverse && !isCPCClassic && minHueDistance > 0) {
      const hueDist = calculateMinHueDistance(candidate, selectedConverted)
      if (hueDist < minHueDistance) {
        isDiverse = false
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
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  return selectByBalancedScoreCore(
    candidates,
    targetColors,
    preselectedIndices,
    { frequency: 0.5, diversity: 0.25, luminance: 0.25 },
    options
  )
}

/**
 * balanced-score-max : Contraste prioritaire (30% freq, 35% div, 35% lum)
 */
export const selectByBalancedScoreMax: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  return selectByBalancedScoreCore(
    candidates,
    targetColors,
    preselectedIndices,
    { frequency: 0.3, diversity: 0.35, luminance: 0.35 },
    options
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
  weights: { frequency: number; diversity: number; luminance: number },
  isCPCClassic: boolean,
  minHueDistance: number
): { candidate: ColorCandidate; score: number } | null {
  let bestScore = -Infinity
  let bestCandidate: ColorCandidate | null = null

  for (const candidate of candidates) {
    if (result.includes(candidate.index)) continue

    // Pour CPC Plus, vérifier la distance de teinte minimale
    if (!isCPCClassic && minHueDistance > 0) {
      const hueDist = calculateMinHueDistance(candidate, selectedColors)
      if (hueDist < minHueDistance) continue
    }

    const totalScore = calculateBalancedScore(
      candidate,
      selectedColors,
      selectedLuminances,
      maxFreq,
      weights
    )

    // Pour CPC Plus, bonus de teinte dans le score
    const hueBonus = isCPCClassic
      ? 0
      : (calculateMinHueDistance(candidate, selectedColors) / 180) * 0.15

    if (totalScore + hueBonus > bestScore) {
      bestScore = totalScore + hueBonus
      bestCandidate = candidate
    }
  }

  return bestCandidate ? { candidate: bestCandidate, score: bestScore } : null
}

function selectByBalancedScoreCore(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[],
  weights: { frequency: number; diversity: number; luminance: number },
  options?: StrategyOptions
): StrategyResult {
  const result = [...preselectedIndices]
  const scores = new Map<number, number>()

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  const isCPCClassic = isCPCClassicPalette(options, candidates.length)
  const minHueDistance = isCPCClassic ? 0 : 60

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
      weights,
      isCPCClassic,
      minHueDistance
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
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  return selectByPerceptualCore(
    candidates,
    targetColors,
    preselectedIndices,
    true,
    options
  )
}

/**
 * perceptual-max : Luminance bins avec diversité prioritaire
 */
export const selectByPerceptualMax: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  return selectByPerceptualCore(
    candidates,
    targetColors,
    preselectedIndices,
    false,
    options
  )
}

function selectByPerceptualCore(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[],
  prioritizeFrequency: boolean,
  options?: StrategyOptions
): StrategyResult {
  const result = [...preselectedIndices]

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors) }
  }

  const isCPCClassic = isCPCClassicPalette(options, candidates.length)
  const minHueDistance = isCPCClassic ? 0 : 60

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

    let inBin = withLuminance.filter(
      (c) =>
        c.luminance >= minLum &&
        c.luminance < maxLum &&
        !result.includes(c.index)
    )

    // Pour CPC Plus, filtrer par distance de teinte
    if (!isCPCClassic && minHueDistance > 0 && result.length > 0) {
      const selectedColors = result.map(
        (idx) => candidates.find((c) => c.index === idx)!.converted
      )
      const filtered = inBin.filter((c) => {
        const hueDist = calculateMinHueDistance(c, selectedColors)
        return hueDist >= minHueDistance
      })
      if (filtered.length > 0) {
        inBin = filtered
      }
    }

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
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  return selectByDiversityFirstCore(
    candidates,
    targetColors,
    preselectedIndices,
    0.1,
    options
  )
}

/**
 * diversity-first-max : Diversité pure (100% diversité, 0% fréquence)
 */
export const selectByDiversityFirstMax: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  return selectByDiversityFirstCore(
    candidates,
    targetColors,
    preselectedIndices,
    0,
    options
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
  minHueDistance: number
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
      minLuminanceDistance: params.minLuminanceDistance,
      minHueDistance: params.minHueDistance
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
  frequencyWeight: number,
  options?: StrategyOptions
): StrategyResult {
  const result = [...preselectedIndices]
  const scores = new Map<number, number>()

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  initializeSelection(result, candidates)

  // Utiliser la nouvelle fonction de détection CPC Classic/Plus
  const isCPCClassic = isCPCClassicPalette(options, candidates.length)
  // Pour CPC Plus en mode 1, on a besoin de distances beaucoup plus grandes
  // car la palette de 4096 couleurs contient beaucoup de dégradés similaires
  const MIN_COLOR_DISTANCE = isCPCClassic ? 50 : 140
  const MIN_LUMINANCE_DISTANCE = isCPCClassic ? 0.15 : 0.35
  // Pour CPC Plus, imposer une distance de teinte minimale de 45° entre les couleurs
  // Cela évite les palettes avec des dégradés de même teinte
  const MIN_HUE_DISTANCE = isCPCClassic ? 0 : 45

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
      minLuminanceDistance: MIN_LUMINANCE_DISTANCE,
      minHueDistance: MIN_HUE_DISTANCE
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
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  // Analyser la distribution des candidats
  const avgFrequency =
    candidates.reduce((sum, c) => sum + c.frequency, 0) / candidates.length
  const maxFrequency = Math.max(...candidates.map((c) => c.frequency))
  const frequencyVariance = maxFrequency / avgFrequency

  // Si une couleur domine fortement, privilégier la fréquence
  if (frequencyVariance > FREQUENCY_VARIANCE_THRESHOLD) {
    return selectByFrequencyBalanced(
      candidates,
      targetColors,
      preselectedIndices,
      options
    )
  }

  // Sinon, utiliser balanced-score pour un bon compromis
  return selectByBalancedScoreBalanced(
    candidates,
    targetColors,
    preselectedIndices,
    options
  )
}

// ============================================================================
// EXHAUSTIVE CONTRAST STRATEGY
// ============================================================================

/**
 * Génère toutes les combinaisons de k éléments parmi n
 * Avec mémoïsation pour éviter les recalculs
 */
function kCombinationsV2<T>(
  arr: T[],
  k: number,
  memo = new Map<string, T[][]>()
): T[][] {
  const key = `${arr.length}|${k}`
  if (memo.has(key)) return memo.get(key)!

  if (k === 0) return [[]]
  if (arr.length < k) return []
  if (arr.length === k) return [arr]

  const [head, ...tail] = arr
  const withHead = kCombinationsV2(tail, k - 1, memo).map((c) => [head, ...c])
  const withoutHead = kCombinationsV2(tail, k, memo)
  const result = withHead.concat(withoutHead)
  memo.set(key, result)
  return result
}

/**
 * Filtre les combinaisons pour garder celles avec au moins une couleur sombre et une claire
 */
function filterCombinationsByLuminanceV2(
  combinations: number[][],
  preselectedColors: Vector[],
  remainingCandidates: ColorCandidate[]
): number[][] {
  return combinations.filter((combo) => {
    const colors = [
      ...preselectedColors,
      ...combo.map((i) => remainingCandidates[i].converted)
    ]
    return colors.some((c) => isDark(c)) && colors.some((c) => isBright(c))
  })
}

/**
 * Calcule la distance minimale entre toutes les paires de couleurs d'un ensemble
 */
function calculateMinDistanceInSetV2(
  colors: Vector[],
  earlyExitThreshold: number
): number {
  let minDist = Infinity

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = calculatePerceptualDistance(colors[i], colors[j])
      if (d < minDist) minDist = d
      if (minDist <= earlyExitThreshold) return minDist
    }
  }

  return minDist
}

/**
 * Calcule la distance de teinte minimale dans un ensemble de couleurs
 */
function calculateMinHueDistanceInSet(colors: Vector[]): number {
  let minHueDist = 180

  for (let i = 0; i < colors.length; i++) {
    const sat1 = calculateSaturation(colors[i])
    if (sat1 < 0.15) continue // Ignorer les couleurs peu saturées

    const hue1 = calculateHue(colors[i], SATURATION_LOW_THRESHOLD)
    if (hue1 < 0) continue

    for (let j = i + 1; j < colors.length; j++) {
      const sat2 = calculateSaturation(colors[j])
      if (sat2 < 0.15) continue

      const hue2 = calculateHue(colors[j], SATURATION_LOW_THRESHOLD)
      if (hue2 < 0) continue

      const dist = calculateHueDistance(hue1, hue2)
      minHueDist = Math.min(minHueDist, dist)
    }
  }

  return minHueDist
}

/**
 * Vérifie si une couleur est visuellement colorée (pas grise ni trop sombre)
 * Une couleur doit avoir une saturation suffisante ET une luminosité minimale
 */
function isVisuallyColorful(color: Vector): boolean {
  const [r, g, b] = color
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  // Saturation HSV
  const saturation = max === 0 ? 0 : (max - min) / max

  // Luminance perceptuelle (formule standard)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Brightness HSV (pour détecter les couleurs trop claires)
  const brightness = max / 255

  // Une couleur est visuellement colorée si:
  // - Elle a une saturation >= 0.30 (pas grise) - seuil relevé pour plus de saturation
  // - ET une luminance >= 0.20 (pas trop sombre - seuil abaissé pour inclure les couleurs saturées sombres)
  // - ET une brightness <= 0.95 (pas trop claire/blanche)
  // Les couleurs très saturées (>0.7) peuvent avoir une luminance plus basse
  const minLuminance = saturation > 0.7 ? 0.15 : 0.2
  return saturation >= 0.3 && luminance >= minLuminance && brightness <= 0.95
}

/**
 * Compte le nombre de couleurs visuellement colorées
 */
function countVisuallyColorfulColors(colors: Vector[]): number {
  return colors.filter(isVisuallyColorful).length
}

/**
 * Trouve la meilleure combinaison en maximisant la distance minimale
 * Pour CPC Plus, pénalise les combinaisons avec des teintes trop proches
 * ou avec trop de couleurs achromatiques/sombres
 */
function findBestCombinationV2(
  combinations: number[][],
  preselectedColors: Vector[],
  remainingCandidates: ColorCandidate[],
  isCPCClassic: boolean = true
): number[] {
  let bestCombo: number[] = []
  let bestScore = -Infinity

  // Fallback: garder la meilleure combinaison même si elle ne passe pas tous les filtres
  let fallbackCombo: number[] = []
  let fallbackScore = -Infinity

  // Pour CPC Plus, compter combien de candidats sont visuellement colorés
  // (saturés ET avec une luminosité suffisante)
  const colorfulCandidatesCount = isCPCClassic
    ? 0
    : remainingCandidates.filter((c) => isVisuallyColorful(c.converted)).length

  // Si on a des couleurs visuellement colorées disponibles, en exiger au moins 2 sur 4
  const minColorfulRequired =
    !isCPCClassic && colorfulCandidatesCount >= 2 ? 2 : 0

  // Fonction pour calculer la vivacité totale d'une combinaison
  // Calculer la vivacité totale d'un ensemble de couleurs
  // Priorité FORTE à la saturation pour obtenir des couleurs vibrantes
  const calculateTotalVividness = (colors: Vector[]): number => {
    return colors.reduce((sum, color) => {
      const [r, g, b] = color
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      // Saturation² pour favoriser fortement les couleurs très saturées
      // Luminance ne sert qu'à départager
      const brightnessBonus = luminance > 0.25 && luminance < 0.85 ? 1 : 0.3
      return sum + saturation * saturation * brightnessBonus
    }, 0)
  }

  // Calculer la saturation moyenne d'un ensemble de couleurs (hors noir/blanc)
  const calculateAverageSaturation = (colors: Vector[]): number => {
    const saturatedColors = colors.filter(([r, g, b]) => {
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      return luminance > 0.15 && luminance < 0.85 // Exclure noir et blanc
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

  for (const combo of combinations) {
    const colors = [
      ...preselectedColors,
      ...combo.map((i) => remainingCandidates[i].converted)
    ]

    const minDist = calculateMinDistanceInSetV2(
      colors,
      Math.max(bestScore, fallbackScore)
    )
    let baseScore = minDist

    // Calculer le score avec bonus pour CPC Plus
    if (!isCPCClassic) {
      const minHueDist = calculateMinHueDistanceInSet(colors)
      const colorfulCount = countVisuallyColorfulColors(colors)
      const totalVividness = calculateTotalVividness(colors)
      const avgSaturation = calculateAverageSaturation(colors)

      // Bonus important pour une bonne diversité de teinte (> 60°)
      if (minHueDist >= 60) {
        baseScore += minHueDist * 1.5
      } else if (minHueDist >= 45) {
        baseScore += minHueDist * 0.5
      }

      // Bonus significatif pour les couleurs visuellement colorées
      baseScore += colorfulCount * 30

      // Bonus TRÈS FORT pour la vivacité totale (favorise les couleurs vives)
      baseScore += totalVividness * 100

      // Bonus TRÈS FORT pour la saturation moyenne élevée
      baseScore += avgSaturation * 150
    }

    // Mettre à jour le fallback (meilleure combinaison sans filtres stricts)
    if (baseScore > fallbackScore) {
      fallbackScore = baseScore
      fallbackCombo = combo
    }

    // Pour CPC Plus, appliquer les filtres stricts
    if (!isCPCClassic) {
      // Vérifier le nombre de couleurs visuellement colorées
      if (minColorfulRequired > 0) {
        const colorfulCount = countVisuallyColorfulColors(colors)
        if (colorfulCount < minColorfulRequired) {
          continue // Skip cette combinaison
        }
      }

      // Vérifier la distance de teinte minimale
      const minHueDist = calculateMinHueDistanceInSet(colors)
      // Rejeter les combinaisons avec des teintes trop proches (<= 40°)
      if (minHueDist <= 40) {
        continue // Skip cette combinaison
      }

      // Vérifier la saturation moyenne (exclure les palettes ternes)
      const avgSaturation = calculateAverageSaturation(colors)
      if (avgSaturation < 0.4) {
        continue // Skip les combinaisons avec saturation moyenne < 40% (réduit de 50%)
      }
    }

    if (baseScore > bestScore) {
      bestScore = baseScore
      bestCombo = combo
    }
  }

  // Si aucune combinaison ne passe les filtres, utiliser un fallback intelligent
  if (bestCombo.length === 0 && fallbackCombo.length > 0) {
    // Fallback intelligent : sélectionner des couleurs avec des teintes diverses
    // au lieu de prendre la combinaison avec le meilleur score de contraste
    const selectedArrayIndices: number[] = [] // Indices dans remainingCandidates (pas dans la palette de base)
    const usedHues: number[] = []
    const MIN_HUE_DISTANCE = 45 // Distance minimale entre teintes (réduit de 60 à 45 pour plus de diversité)
    const neededColors = fallbackCombo.length // Nombre de couleurs à sélectionner

    // Initialiser usedHues avec les couleurs présélectionnées (lockées)
    // pour éviter de sélectionner des couleurs trop similaires
    for (const preColor of preselectedColors) {
      const preHue = calculateHue(preColor, SATURATION_LOW_THRESHOLD)
      const preSat = calculateSaturation(preColor)
      if (preSat > 0.2 && preHue >= 0) {
        usedHues.push(preHue)
      }
    }

    // Vérifier si une couleur sombre est déjà présélectionnée
    const hasDarkPreselected = preselectedColors.some((c) => {
      const lum = calculateLuminance(c)
      return lum < 0.1 // Seuil strict pour "vraiment sombre"
    })

    // ÉTAPE 1 : Forcer une couleur sombre EN PREMIER si pas déjà présélectionnée
    // Note: On n'ajoute PAS la teinte de la couleur sombre à usedHues
    // car les couleurs très sombres n'ont pas vraiment de teinte perceptible
    if (!hasDarkPreselected) {
      let darkestIdx = -1
      let darkestLum = Infinity
      for (let i = 0; i < remainingCandidates.length; i++) {
        const lum = calculateLuminance(remainingCandidates[i].converted)
        if (lum < darkestLum) {
          darkestLum = lum
          darkestIdx = i
        }
      }
      if (darkestIdx >= 0 && darkestLum < 0.15) {
        selectedArrayIndices.push(darkestIdx)
      }
    }

    // Créer un tableau avec l'index dans remainingCandidates + le candidat
    const candidatesWithArrayIndex = remainingCandidates.map(
      (candidate, arrayIndex) => ({
        candidate,
        arrayIndex
      })
    )

    // Trier par vividness (saturation * luminance) pour favoriser les couleurs saturées
    candidatesWithArrayIndex.sort((a, b) => {
      const vividnessA = calculateVividnessForColor(a.candidate.converted)
      const vividnessB = calculateVividnessForColor(b.candidate.converted)
      return vividnessB - vividnessA
    })

    // ÉTAPE 2 : Sélectionner les couleurs avec diversité de teinte
    for (const { candidate, arrayIndex } of candidatesWithArrayIndex) {
      if (selectedArrayIndices.length >= neededColors) break
      if (selectedArrayIndices.includes(arrayIndex)) continue // Déjà sélectionné (couleur sombre)

      const hue = calculateHue(candidate.converted, SATURATION_LOW_THRESHOLD)
      const saturation = calculateSaturation(candidate.converted)
      const luminance = calculateLuminance(candidate.converted)

      // Éviter les couleurs trop sombres (on en a déjà une)
      if (luminance < 0.15) {
        continue
      }

      // Vérifier si cette teinte est assez différente des teintes déjà sélectionnées
      const isSaturated = saturation > 0.2
      let isHueDiverse = true
      let minHueDistFound = 360

      if (isSaturated && hue >= 0) {
        for (const usedHue of usedHues) {
          const hueDist = Math.min(
            Math.abs(hue - usedHue),
            360 - Math.abs(hue - usedHue)
          )
          if (hueDist < minHueDistFound) {
            minHueDistFound = hueDist
          }
          if (hueDist < MIN_HUE_DISTANCE) {
            isHueDiverse = false
            break
          }
        }
      }

      if (isHueDiverse) {
        selectedArrayIndices.push(arrayIndex)
        if (isSaturated && hue >= 0) {
          usedHues.push(hue)
        }
      }
    }

    // Si on n'a pas assez de couleurs, compléter avec les restants
    // mais en respectant quand même une distance de teinte minimale (plus permissive)
    if (selectedArrayIndices.length < neededColors) {
      const FALLBACK_MIN_HUE_DISTANCE = 30 // Plus permissif pour le fallback du fallback

      for (const { candidate, arrayIndex } of candidatesWithArrayIndex) {
        if (selectedArrayIndices.length >= neededColors) break
        if (selectedArrayIndices.includes(arrayIndex)) continue

        const hue = calculateHue(candidate.converted, SATURATION_LOW_THRESHOLD)
        const saturation = calculateSaturation(candidate.converted)
        const isSaturated = saturation > 0.2

        // Vérifier la diversité de teinte même pour le fallback
        let isHueDiverse = true
        if (isSaturated && hue >= 0) {
          for (const usedHue of usedHues) {
            const hueDist = Math.min(
              Math.abs(hue - usedHue),
              360 - Math.abs(hue - usedHue)
            )
            if (hueDist < FALLBACK_MIN_HUE_DISTANCE) {
              isHueDiverse = false
              break
            }
          }
        }

        if (isHueDiverse) {
          selectedArrayIndices.push(arrayIndex)
          if (isSaturated && hue >= 0) {
            usedHues.push(hue)
          }
        }
      }
    }

    // Dernier recours : si on n'a toujours pas assez, prendre les couleurs restantes
    // mais en gardant quand même une distance minimale de teinte (très permissive)
    if (selectedArrayIndices.length < neededColors) {
      const LAST_RESORT_MIN_HUE_DISTANCE = 20 // Distance minimale même en dernier recours

      for (const { candidate, arrayIndex } of candidatesWithArrayIndex) {
        if (selectedArrayIndices.length >= neededColors) break
        if (selectedArrayIndices.includes(arrayIndex)) continue

        const hue = calculateHue(candidate.converted, SATURATION_LOW_THRESHOLD)
        const saturation = calculateSaturation(candidate.converted)
        const isSaturated = saturation > 0.2

        // Vérifier la diversité de teinte même en dernier recours
        let isHueDiverse = true
        if (isSaturated && hue >= 0) {
          for (const usedHue of usedHues) {
            const hueDist = Math.min(
              Math.abs(hue - usedHue),
              360 - Math.abs(hue - usedHue)
            )
            if (hueDist < LAST_RESORT_MIN_HUE_DISTANCE) {
              isHueDiverse = false
              break
            }
          }
        }

        if (isHueDiverse) {
          selectedArrayIndices.push(arrayIndex)
          if (isSaturated && hue >= 0) {
            usedHues.push(hue)
          }
        }
      }
    }

    // Ultime recours : si VRAIMENT on n'a pas assez, prendre n'importe quoi
    if (selectedArrayIndices.length < neededColors) {
      for (const { arrayIndex } of candidatesWithArrayIndex) {
        if (selectedArrayIndices.length >= neededColors) break
        if (!selectedArrayIndices.includes(arrayIndex)) {
          selectedArrayIndices.push(arrayIndex)
        }
      }
    }

    return selectedArrayIndices
  }

  return bestCombo
}

/**
 * exhaustive-contrast : Recherche exhaustive de la meilleure combinaison
 *
 * Algorithme :
 * 1. Pré-filtre les candidats pour garder les N plus fréquents (évite explosion combinatoire)
 * 2. Génère toutes les combinaisons possibles de k couleurs
 * 3. Filtre celles qui ont au moins une couleur sombre ET une claire
 * 4. Sélectionne celle qui maximise la distance minimale entre paires
 *
 * C'est l'algorithme le plus précis mais aussi le plus coûteux (O(C(n,k)))
 * Idéal pour les petites palettes (2-4 couleurs) où la qualité prime
 */
export const selectByExhaustiveContrast: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  const result: number[] = [...preselectedIndices]
  const scores = new Map<number, number>()

  // Marquer les indices déjà sélectionnés
  const usedIndices = new Set(preselectedIndices)

  // Récupérer les couleurs présélectionnées depuis les options (si disponibles)
  // Sinon, essayer de les trouver dans les candidats (fallback)
  const preselectedColors =
    options?.preselectedColors ??
    preselectedIndices
      .map((idx) => candidates.find((c) => c.index === idx)?.converted)
      .filter((c): c is Vector => c !== undefined)

  // Filtrer les candidats restants (exclure ceux déjà sélectionnés)
  let remainingCandidates = candidates.filter((c) => !usedIndices.has(c.index))

  // Filtrer les candidats trop proches des couleurs présélectionnées (lockées)
  // pour éviter d'avoir des doublons visuels
  if (preselectedColors.length > 0) {
    remainingCandidates = remainingCandidates.filter((c) => {
      for (const preColor of preselectedColors) {
        const dist = calculatePerceptualDistance(c.converted, preColor)
        if (dist < MIN_DISTANCE_FROM_PRESELECTED) {
          return false // Trop proche d'une couleur présélectionnée
        }
      }
      return true
    })
  }

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  const needed = targetColors - result.length

  if (remainingCandidates.length <= needed) {
    // Pas assez de candidats, prendre tous
    for (const c of remainingCandidates) {
      result.push(c.index)
      scores.set(c.index, c.frequency)
    }
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  // Déterminer si on est en CPC Classic ou Plus
  const isCPCClassic = isCPCClassicPalette(options, candidates.length)

  // OPTIMISATION: Limiter le nombre de candidats pour éviter l'explosion combinatoire
  // Pour CPC Plus, on peut se permettre plus de candidats car l'espace est plus grand
  // C(12, 4) = 495 combinaisons - acceptable
  // C(16, 4) = 1820 combinaisons - limite acceptable pour CPC Plus
  // C(20, 4) = 4845 combinaisons - trop lent
  const maxCandidates = isCPCClassic
    ? MAX_CANDIDATES_CLASSIC
    : MAX_CANDIDATES_PLUS

  // Pour CPC Plus, on veut plus de couleurs sombres et claires pour maximiser le contraste
  const darkCount = isCPCClassic ? DARK_COUNT_CLASSIC : DARK_COUNT_PLUS
  const brightCount = isCPCClassic ? BRIGHT_COUNT_CLASSIC : BRIGHT_COUNT_PLUS

  if (remainingCandidates.length > maxCandidates) {
    if (isCPCClassic) {
      // Pour CPC Classic : garder les plus fréquents avec contraste luminance
      const sorted = [...remainingCandidates].sort(
        (a, b) => b.frequency - a.frequency
      )

      // Séparer en couleurs sombres et claires
      const dark = sorted.filter((c) => isDark(c.converted))
      const bright = sorted.filter((c) => isBright(c.converted))

      // S'assurer d'avoir assez de couleurs de chaque catégorie si disponibles
      const selectedCandidates: ColorCandidate[] = []
      const addUnique = (c: ColorCandidate) => {
        if (!selectedCandidates.find((s) => s.index === c.index)) {
          selectedCandidates.push(c)
        }
      }

      // Ajouter les couleurs sombres les plus fréquentes
      dark.slice(0, darkCount).forEach(addUnique)
      // Ajouter les couleurs claires les plus fréquentes
      bright.slice(0, brightCount).forEach(addUnique)
      // Compléter avec les couleurs les plus fréquentes (toutes catégories)
      for (const c of sorted) {
        if (selectedCandidates.length >= maxCandidates) break
        addUnique(c)
      }

      remainingCandidates = selectedCandidates
    } else {
      // Pour CPC Plus : utiliser la diversité des teintes
      // Passer les couleurs présélectionnées pour éviter de sélectionner des couleurs trop proches
      remainingCandidates = filterCandidatesWithHueDiversity(
        remainingCandidates,
        maxCandidates,
        false, // isCPCClassic = false
        preselectedColors // Couleurs lockées à éviter
      )
    }
  }

  // Générer tous les indices des candidats restants
  const indices = remainingCandidates.map((_, i) => i)

  // Générer toutes les combinaisons de 'needed' éléments
  const combinations = kCombinationsV2(indices, needed)

  // Filtrer les combinaisons avec contraste luminance (sombre + clair)
  const filtered = filterCombinationsByLuminanceV2(
    combinations,
    preselectedColors,
    remainingCandidates
  )

  // Utiliser les combinaisons filtrées si disponibles, sinon toutes
  const combosToTest = filtered.length > 0 ? filtered : combinations

  // Trouver la meilleure combinaison
  let bestCombo = findBestCombinationV2(
    combosToTest,
    preselectedColors,
    remainingCandidates,
    isCPCClassic
  )

  // GARANTIR une couleur VRAIMENT sombre (proche du noir) dans la sélection finale
  // On utilise un seuil plus strict que isDark() pour forcer une couleur proche du noir
  const hasDarkPreselected = preselectedColors.some(
    (c) => calculateLuminance(c) < LUMINANCE_VERY_DARK_THRESHOLD
  )
  const hasDarkInCombo = bestCombo.some(
    (i) =>
      calculateLuminance(remainingCandidates[i].converted) <
      LUMINANCE_VERY_DARK_THRESHOLD
  )

  if (!hasDarkPreselected && !hasDarkInCombo && bestCombo.length > 0) {
    // Trouver la couleur la plus sombre parmi les candidats
    let darkestIdx = -1
    let darkestLum = Infinity
    for (let i = 0; i < remainingCandidates.length; i++) {
      const lum = calculateLuminance(remainingCandidates[i].converted)
      if (lum < darkestLum) {
        darkestLum = lum
        darkestIdx = i
      }
    }
    // Remplacer la dernière couleur par la plus sombre si elle est vraiment sombre
    if (
      darkestIdx >= 0 &&
      darkestLum < LUMINANCE_DARK_UPPER &&
      !bestCombo.includes(darkestIdx)
    ) {
      bestCombo = [...bestCombo]
      bestCombo[bestCombo.length - 1] = darkestIdx
    }
  }

  // Ajouter les couleurs de la meilleure combinaison
  for (const i of bestCombo) {
    const candidate = remainingCandidates[i]
    result.push(candidate.index)
    // Score basé sur la position dans la combinaison optimale
    scores.set(candidate.index, 1 - i * 0.1)
  }

  return { selectedIndices: result, scores }
}

// ============================================================================
// COVERAGE-AWARE STRATEGY
// ============================================================================

/**
 * Calcule le score de couverture d'une combinaison de couleurs
 *
 * Pour chaque candidat, on regarde combien de couleurs de l'image
 * seraient "bien représentées" (distance < threshold) par cette palette
 */
function calculateCoverageScore(
  selectedIndices: number[],
  allCandidates: ColorCandidate[],
  coverageThreshold: number
): { coverage: number; avgDistance: number } {
  const selectedColors = selectedIndices.map(
    (idx) => allCandidates.find((c) => c.index === idx)!.converted
  )

  let totalCovered = 0
  let totalDistance = 0
  let totalFrequency = 0

  for (const candidate of allCandidates) {
    // Trouver la distance à la couleur la plus proche dans la sélection
    let minDist = Infinity
    for (const selected of selectedColors) {
      const dist = calculatePerceptualDistance(candidate.converted, selected)
      if (dist < minDist) minDist = dist
    }

    totalFrequency += candidate.frequency

    if (minDist <= coverageThreshold) {
      totalCovered += candidate.frequency
      totalDistance += minDist * candidate.frequency
    }
  }

  const coverage = totalFrequency > 0 ? totalCovered / totalFrequency : 0
  const avgDistance = totalCovered > 0 ? totalDistance / totalCovered : Infinity

  return { coverage, avgDistance }
}

/**
 * coverage-aware : Maximise la couverture des couleurs de l'image
 *
 * Algorithme :
 * 1. Pour chaque combinaison possible de couleurs
 * 2. Calcule le % de pixels de l'image "bien représentés" (distance < seuil)
 * 3. Sélectionne la combinaison avec la meilleure couverture
 * 4. En cas d'égalité, préfère celle avec la distance moyenne la plus faible
 *
 * Idéal pour les images avec beaucoup de nuances où on veut minimiser l'erreur globale
 */
export const selectByCoverageAware: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  const result: number[] = [...preselectedIndices]
  const scores = new Map<number, number>()

  // Récupérer les couleurs présélectionnées depuis les options (si disponibles)
  const preselectedColors =
    options?.preselectedColors ??
    preselectedIndices
      .map((idx) => candidates.find((c) => c.index === idx)?.converted)
      .filter((c): c is Vector => c !== undefined)

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  const usedIndices = new Set(preselectedIndices)
  let remainingCandidates = candidates.filter((c) => !usedIndices.has(c.index))

  const needed = targetColors - result.length

  if (remainingCandidates.length <= needed) {
    for (const c of remainingCandidates) {
      result.push(c.index)
      scores.set(c.index, c.frequency)
    }
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  // Limiter les candidats pour la recherche exhaustive
  // Déterminer si on est en CPC Classic ou Plus
  const isCPCClassic = isCPCClassicPalette(options, candidates.length)
  const MAX_CANDIDATES = isCPCClassic ? 14 : 16

  if (remainingCandidates.length > MAX_CANDIDATES) {
    if (isCPCClassic) {
      // Pour CPC Classic : utiliser la logique de contraste luminance
      const sorted = [...remainingCandidates].sort(
        (a, b) => b.frequency - a.frequency
      )
      const dark = sorted.filter((c) => isDark(c.converted))
      const bright = sorted.filter((c) => isBright(c.converted))

      const selectedCandidates: ColorCandidate[] = []
      const addUnique = (c: ColorCandidate) => {
        if (!selectedCandidates.find((s) => s.index === c.index)) {
          selectedCandidates.push(c)
        }
      }

      dark.slice(0, 3).forEach(addUnique)
      bright.slice(0, 3).forEach(addUnique)
      for (const c of sorted) {
        if (selectedCandidates.length >= MAX_CANDIDATES) break
        addUnique(c)
      }

      remainingCandidates = selectedCandidates
    } else {
      // Pour CPC Plus : utiliser la diversité des teintes
      // Passer les couleurs présélectionnées pour éviter de sélectionner des couleurs trop proches
      remainingCandidates = filterCandidatesWithHueDiversity(
        remainingCandidates,
        MAX_CANDIDATES,
        false, // isCPCClassic = false
        preselectedColors // Couleurs lockées à éviter
      )
    }
  }

  // Seuil de couverture adapté à la palette CPC
  // Plus la palette est petite, plus le seuil doit être élevé
  // Pour CPC Plus, le seuil doit être plus bas car l'espace de couleurs est plus grand
  const coverageThreshold = isCPCClassic ? 60 : 45

  const indices = remainingCandidates.map((_, i) => i)
  const combinations = kCombinationsV2(indices, needed)

  let bestCombo: number[] = []
  let bestCoverage = -1
  let bestAvgDistance = Infinity

  for (const combo of combinations) {
    const testIndices = [
      ...result,
      ...combo.map((i) => remainingCandidates[i].index)
    ]

    const { coverage, avgDistance } = calculateCoverageScore(
      testIndices,
      candidates,
      coverageThreshold
    )

    // Préférer meilleure couverture, puis distance plus faible
    if (
      coverage > bestCoverage ||
      (coverage === bestCoverage && avgDistance < bestAvgDistance)
    ) {
      bestCoverage = coverage
      bestAvgDistance = avgDistance
      bestCombo = combo
    }
  }

  for (const i of bestCombo) {
    const candidate = remainingCandidates[i]
    result.push(candidate.index)
    scores.set(candidate.index, bestCoverage)
  }

  return { selectedIndices: result, scores }
}

// ============================================================================
// DITHERING-AWARE STRATEGY
// ============================================================================

/**
 * Calcule la couleur moyenne résultant du mélange de deux couleurs en dithering 50/50
 */
function blendColors(c1: Vector, c2: Vector): Vector {
  return [
    Math.round((c1[0] + c2[0]) / 2),
    Math.round((c1[1] + c2[1]) / 2),
    Math.round((c1[2] + c2[2]) / 2)
  ] as Vector
}

/**
 * Cache des distances entre couleurs pour éviter les recalculs
 */
type DistanceCache = Map<string, number>

/**
 * Génère une clé de cache pour une paire de couleurs
 */
function colorKey(c: Vector): string {
  return `${c[0]},${c[1]},${c[2]}`
}

/**
 * Calcule la distance avec cache
 */
function cachedDistance(c1: Vector, c2: Vector, cache: DistanceCache): number {
  const key = `${colorKey(c1)}|${colorKey(c2)}`
  const reverseKey = `${colorKey(c2)}|${colorKey(c1)}`

  if (cache.has(key)) return cache.get(key)!
  if (cache.has(reverseKey)) return cache.get(reverseKey)!

  const dist = calculatePerceptualDistance(c1, c2)
  cache.set(key, dist)
  return dist
}

/**
 * Échantillonne les candidats pour l'évaluation du dithering
 * Garde les plus fréquents + un échantillon diversifié
 */
function sampleCandidatesForDithering(
  candidates: ColorCandidate[],
  maxSamples: number
): { color: Vector; frequency: number }[] {
  if (candidates.length <= maxSamples) {
    return candidates.map((c) => ({
      color: c.converted,
      frequency: c.frequency
    }))
  }

  // Trier par fréquence et prendre les top
  const sorted = [...candidates].sort((a, b) => b.frequency - a.frequency)
  const topCount = Math.ceil(maxSamples * 0.7) // 70% les plus fréquents
  const diverseCount = maxSamples - topCount

  const sampled: { color: Vector; frequency: number }[] = []

  // Ajouter les plus fréquents
  for (let i = 0; i < topCount && i < sorted.length; i++) {
    sampled.push({ color: sorted[i].converted, frequency: sorted[i].frequency })
  }

  // Ajouter un échantillon diversifié parmi les restants
  if (diverseCount > 0 && sorted.length > topCount) {
    const remaining = sorted.slice(topCount)
    const step = Math.max(1, Math.floor(remaining.length / diverseCount))
    for (
      let i = 0;
      i < remaining.length && sampled.length < maxSamples;
      i += step
    ) {
      sampled.push({
        color: remaining[i].converted,
        frequency: remaining[i].frequency
      })
    }
  }

  return sampled
}

/**
 * dithering-aware : Sélectionne des couleurs qui se mélangent bien en dithering
 *
 * Algorithme optimisé :
 * 1. Échantillonne les candidats pour l'évaluation (évite de tester tous les pixels)
 * 2. Utilise un cache de distances pour éviter les recalculs
 * 3. Pour chaque combinaison, calcule la palette "étendue" (couleurs + mélanges 50/50)
 * 4. Évalue combien de couleurs de l'échantillon sont couvertes par cette palette étendue
 *
 * Idéal pour les modes avec peu de couleurs (2-4) où le dithering est crucial
 */
export const selectByDitheringAware: PaletteStrategyFunction = (
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult => {
  const result: number[] = [...preselectedIndices]
  const scores = new Map<number, number>()

  // Récupérer les couleurs présélectionnées depuis les options (si disponibles)
  const preselectedColors =
    options?.preselectedColors ??
    preselectedIndices
      .map((idx) => candidates.find((c) => c.index === idx)?.converted)
      .filter((c): c is Vector => c !== undefined)

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  const usedIndices = new Set(preselectedIndices)
  let remainingCandidates = candidates.filter((c) => !usedIndices.has(c.index))

  const needed = targetColors - result.length

  if (remainingCandidates.length <= needed) {
    for (const c of remainingCandidates) {
      result.push(c.index)
      scores.set(c.index, c.frequency)
    }
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  // Seuil de couverture pour le dithering (plus tolérant car les blends aident)
  const isCPCClassic = isCPCClassicPalette(options, candidates.length)
  const coverageThreshold = isCPCClassic ? 50 : 40

  // Limiter les candidats avec diversité de teinte
  const MAX_CANDIDATES = isCPCClassic ? 12 : 14
  if (remainingCandidates.length > MAX_CANDIDATES) {
    remainingCandidates = filterCandidatesWithHueDiversity(
      remainingCandidates,
      MAX_CANDIDATES,
      isCPCClassic,
      preselectedColors
    )
  }

  // Pré-extraire les couleurs des candidats restants pour éviter les lookups répétés
  const candidateColors = remainingCandidates.map((c) => c.converted)

  // Échantillonner les candidats pour l'évaluation (max 50 pour la performance)
  const MAX_SAMPLES = 50
  const sampledCandidates = sampleCandidatesForDithering(
    candidates,
    MAX_SAMPLES
  )
  const totalSampledFrequency = sampledCandidates.reduce(
    (sum, c) => sum + c.frequency,
    0
  )

  // Cache de distances partagé entre toutes les combinaisons
  const distanceCache: DistanceCache = new Map()

  const indices = remainingCandidates.map((_, i) => i)
  const combinations = kCombinationsV2(indices, needed)

  // Filtrer pour avoir contraste luminance
  const filtered = filterCombinationsByLuminanceV2(
    combinations,
    preselectedColors,
    remainingCandidates
  )

  const combosToTest = filtered.length > 0 ? filtered : combinations

  let bestCombo: number[] = []
  let bestExpandedCoverage = -1

  for (const combo of combosToTest) {
    // Construire la palette complète : couleurs présélectionnées + combo
    const comboColors = combo.map((i) => candidateColors[i])
    const allColors = [...preselectedColors, ...comboColors]

    // Calculer le score avec la palette complète
    const expandedCoverage = calculateDitheringScoreOptimizedDirect(
      allColors,
      sampledCandidates,
      totalSampledFrequency,
      coverageThreshold,
      distanceCache
    )

    if (expandedCoverage > bestExpandedCoverage) {
      bestExpandedCoverage = expandedCoverage
      bestCombo = combo
    }
  }

  for (const i of bestCombo) {
    const candidate = remainingCandidates[i]
    result.push(candidate.index)
    scores.set(candidate.index, bestExpandedCoverage)
  }

  return { selectedIndices: result, scores }
}

/**
 * Version directe qui prend les couleurs au lieu des indices
 */
function calculateDitheringScoreOptimizedDirect(
  selectedColors: Vector[],
  sampledCandidates: { color: Vector; frequency: number }[],
  totalSampledFrequency: number,
  coverageThreshold: number,
  distanceCache: DistanceCache
): number {
  // Construire la palette étendue avec les blends
  const extended: Vector[] = [...selectedColors]
  for (let i = 0; i < selectedColors.length; i++) {
    for (let j = i + 1; j < selectedColors.length; j++) {
      extended.push(blendColors(selectedColors[i], selectedColors[j]))
    }
  }

  let totalCovered = 0

  for (const { color, frequency } of sampledCandidates) {
    let minDist = Infinity

    for (const paletteColor of extended) {
      const dist = cachedDistance(color, paletteColor, distanceCache)
      if (dist < minDist) {
        minDist = dist
        // Early exit si déjà couvert
        if (minDist <= coverageThreshold) break
      }
    }

    if (minDist <= coverageThreshold) {
      totalCovered += frequency
    }
  }

  return totalSampledFrequency > 0 ? totalCovered / totalSampledFrequency : 0
}

/**
 * Type pour les noms de stratégies de palette v2
 */
export type PaletteStrategyName =
  | 'exhaustive-contrast'
  | 'coverage-aware'
  | 'dithering-aware'
  | 'frequency-balanced'
  | 'frequency-max'
  | 'balanced-score-balanced'
  | 'balanced-score-max'
  | 'perceptual-balanced'
  | 'perceptual-max'
  | 'diversity-first-balanced'
  | 'diversity-first-max'
  | 'adaptive'

/**
 * Map des stratégies de palette v2
 * Centralisée pour éviter la duplication des switch statements
 */
const PALETTE_STRATEGY_MAP: Record<
  PaletteStrategyName,
  PaletteStrategyFunction
> = {
  'exhaustive-contrast': selectByExhaustiveContrast,
  'coverage-aware': selectByCoverageAware,
  'dithering-aware': selectByDitheringAware,
  'frequency-balanced': selectByFrequencyBalanced,
  'frequency-max': selectByFrequencyMax,
  'balanced-score-balanced': selectByBalancedScoreBalanced,
  'balanced-score-max': selectByBalancedScoreMax,
  'perceptual-balanced': selectByPerceptualBalanced,
  'perceptual-max': selectByPerceptualMax,
  'diversity-first-balanced': selectByDiversityFirstBalanced,
  'diversity-first-max': selectByDiversityFirstMax,
  adaptive: selectByAdaptive
}

/**
 * Applique une stratégie de palette v2 de manière centralisée
 * Évite la duplication des switch statements entre CPU et GPU quantizers
 *
 * @param strategy - Nom de la stratégie à appliquer
 * @param candidates - Candidats de couleurs avec fréquences
 * @param targetColors - Nombre de couleurs cibles
 * @param preselectedIndices - Indices des couleurs présélectionnées (lockées)
 * @param options - Options incluant basePaletteSize (27 pour CPC Classic, 4096 pour CPC Plus)
 * @returns Résultat de la stratégie avec les indices sélectionnés
 */
export function applyPaletteStrategyV2(
  strategy: PaletteStrategyName,
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = [],
  options?: StrategyOptions
): StrategyResult {
  const strategyFn = PALETTE_STRATEGY_MAP[strategy]

  if (!strategyFn) {
    // Fallback to frequency-balanced if strategy is unknown
    return selectByFrequencyBalanced(
      candidates,
      targetColors,
      preselectedIndices,
      options
    )
  }

  return strategyFn(candidates, targetColors, preselectedIndices, options)
}

/**
 * Vérifie si une stratégie est valide
 */
export function isValidPaletteStrategy(
  strategy: string
): strategy is PaletteStrategyName {
  return strategy in PALETTE_STRATEGY_MAP
}

/**
 * Liste des stratégies disponibles
 */
export const AVAILABLE_STRATEGIES: readonly PaletteStrategyName[] = Object.keys(
  PALETTE_STRATEGY_MAP
) as PaletteStrategyName[]
