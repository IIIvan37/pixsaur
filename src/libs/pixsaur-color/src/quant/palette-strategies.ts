/**
 * Stratégies de sélection de palette pour quantification couleur
 * Permet de comparer différentes approches pour les modes 1-2 (2-4 couleurs)
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
  scores?: Map<number, number> // Scores de chaque couleur sélectionnée
}

/**
 * Calcule la distance euclidienne pondérée entre deux couleurs
 * Utilise weightedRGBDistance déjà définie dans metric/distance.ts
 */
function calculatePerceptualDistance(color1: Vector, color2: Vector): number {
  return Math.sqrt(weightedRGBDistance(color1, color2))
}

/**
 * Stratégie originale : Tri par fréquence avec diversité minimale
 * C'est la stratégie actuellement utilisée dans le code
 */
export function selectByFrequency(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
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

  // Trier par fréquence
  const sorted = [...candidates].sort((a, b) => b.frequency - a.frequency)

  // Distance minimale adaptative
  const minDistance = targetColors <= 4 ? 80 : 20

  for (const candidate of sorted) {
    if (result.includes(candidate.index)) continue
    if (result.length >= targetColors) break

    // Vérifier la diversité
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

/**
 * Stratégie "balanced-score" : Scoring multicritère
 * Combine fréquence (40%), diversité chromatique (30%), contraste luminance (30%)
 */
export function selectByBalancedScore(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult {
  const result = [...preselectedIndices]
  const scores = new Map<number, number>()

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors), scores }
  }

  // Calculer les métriques pour chaque candidat
  const maxFreq = Math.max(...candidates.map((c) => c.frequency))
  const luminances = candidates.map((c) => ({
    index: c.index,
    luminance: calculateLuminance(c.color)
  }))

  // Première couleur : la plus fréquente
  if (result.length === 0 && candidates.length > 0) {
    const first = candidates.reduce((prev, curr) =>
      curr.frequency > prev.frequency ? curr : prev
    )
    result.push(first.index)
  }

  // Sélection itérative avec scoring
  while (result.length < targetColors && candidates.length > 0) {
    let bestScore = -Infinity
    let bestCandidate: ColorCandidate | null = null

    for (const candidate of candidates) {
      if (result.includes(candidate.index)) continue

      // 1. Score de fréquence (0-1) - 40%
      const freqScore = candidate.frequency / maxFreq

      // 2. Score de diversité chromatique (0-1) - 30%
      const selectedColors = result.map(
        (idx) => candidates.find((c) => c.index === idx)!.converted
      )
      let minColorDist = Infinity
      for (const selected of selectedColors) {
        const dist = calculatePerceptualDistance(candidate.converted, selected)
        minColorDist = Math.min(minColorDist, dist)
      }
      // Normaliser : distance maximale théorique = sqrt(255² * (0.299+0.587+0.114)) ≈ 255
      const diversityScore = Math.min(1, minColorDist / 255)

      // 3. Score de contraste de luminance (0-1) - 30%
      const candidateLum = calculateLuminance(candidate.color)
      const selectedLuminances = result.map(
        (idx) => luminances.find((l) => l.index === idx)!.luminance
      )

      let minLumDist = Infinity
      for (const selectedLum of selectedLuminances) {
        const dist = Math.abs(candidateLum - selectedLum)
        minLumDist = Math.min(minLumDist, dist)
      }
      const luminanceScore = minLumDist // Déjà entre 0 et 1

      // Vérifier qu'on a au moins une couleur sombre et une claire
      const hasDark = selectedLuminances.some((l) => l < 0.3)
      const hasBright = selectedLuminances.some((l) => l > 0.7)
      let balanceBonus = 0
      if (!hasDark && candidateLum < 0.3) balanceBonus = 0.2
      if (!hasBright && candidateLum > 0.7) balanceBonus = 0.2

      // Score final pondéré
      const totalScore =
        freqScore * 0.4 +
        diversityScore * 0.3 +
        luminanceScore * 0.3 +
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
      // Aucun candidat trouvé, prendre le plus fréquent restant
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

/**
 * Stratégie "perceptual" : Basée sur la distribution de luminance
 * Privilégie les couleurs qui couvrent bien le spectre de luminance
 */
export function selectByPerceptual(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult {
  const result = [...preselectedIndices]

  if (result.length >= targetColors) {
    return { selectedIndices: result.slice(0, targetColors) }
  }

  // Calculer la luminance de tous les candidats
  const withLuminance = candidates.map((c) => ({
    ...c,
    luminance: calculateLuminance(c.color)
  }))

  // Trier par fréquence d'abord
  withLuminance.sort((a, b) => b.frequency - a.frequency)

  // Diviser le spectre de luminance en tranches
  const numBins = Math.min(targetColors, 4)
  const binSize = 1.0 / numBins

  // Sélectionner au moins une couleur par tranche de luminance
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
      // Prendre la plus fréquente de cette tranche
      result.push(inBin[0].index)
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

/**
 * Stratégie "adaptive" : Choix dynamique selon l'image
 * TODO: Analyser l'image pour choisir la meilleure stratégie
 * Pour l'instant, utilise balanced-score comme fallback
 */
export function selectByAdaptive(
  candidates: ColorCandidate[],
  targetColors: number,
  preselectedIndices: number[] = []
): StrategyResult {
  // TODO: Implémenter l'analyse de l'image
  // - Calculer la variance des couleurs
  // - Détecter si l'image est sombre/claire/contrastée
  // - Choisir la stratégie optimale

  // Pour l'instant, utiliser balanced-score
  return selectByBalancedScore(candidates, targetColors, preselectedIndices)
}
