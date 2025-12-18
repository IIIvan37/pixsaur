/**
 * Helpers pour la sélection de couleurs dans les palettes CPC
 *
 * Ces fonctions sont extraites de ReGLQuantizer pour:
 * - Faciliter les tests unitaires
 * - Réutilisation potentielle
 * - Meilleure lisibilité du code principal
 *
 * IMPORTANT: Ce module préserve exactement le comportement de production (c244923)
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  calculateHue,
  calculateHueDistance,
  calculateSaturation
} from '@/libs/pixsaur-color/src/utils/hsv'

// ============================================================================
// Constantes de configuration
// ============================================================================

/** Nombre max de couleurs pour modes 1-2 (mode 0 = plus de 4 couleurs) */
export const CPC_MODE_1_MAX_COLORS = 4

/** Distance RGB minimale pour mode 0 (16 couleurs) */
export const MIN_RGB_DISTANCE_MODE_0 = 20

/** Distance RGB minimale pour modes 1-2 (2-4 couleurs) - contraste plus élevé */
export const MIN_RGB_DISTANCE_MODE_1_2 = 80

/** Distance de teinte minimale pour mode 0 (degrés) */
export const MIN_HUE_DISTANCE_MODE_0 = 30

/** Seuil de saturation pour considérer une couleur comme "saturée" */
export const SATURATION_THRESHOLD_FOR_HUE = 0.2

/** Seuil de saturation élevé pour vérification de teinte */
export const SATURATION_THRESHOLD_HIGH = 0.3

/** Delta minimum pour calcul de teinte (évite les erreurs sur les gris) */
export const DELTA_MIN_FOR_HUE = 0.01

/** Taille des buckets de teinte en degrés (~8 familles: 360/45 = 8) */
export const HUE_BUCKET_SIZE_DEGREES = 45

/** Demi-range de teinte pour normalisation */
export const HUE_HALF_RANGE = 180

/** Facteur de normalisation du bonus de teinte */
export const HUE_BONUS_NORMALIZATION = 200

/** Poids du bonus de teinte dans le score MaxMin */
export const HUE_BONUS_WEIGHT = 2

// ============================================================================
// Types
// ============================================================================

/** Représente une couleur candidate avec ses métadonnées */
export interface ColorFrequencyItem {
  /** Index dans la palette de base */
  index: number
  /** Fréquence d'apparition (0-1) */
  frequency: number
  /** Couleur originale RGB */
  color: Vector
  /** Couleur convertie/mappée RGB */
  converted: Vector
}

/** Fonction de calcul de distance entre deux couleurs */
export type DistanceFunction = (a: Vector, b: Vector) => number

/** Bucket de teinte avec ses couleurs */
export interface HueBucket {
  /** Clé du bucket (numéro ou 'gray') */
  bucket: number | 'gray'
  /** Couleurs triées par fréquence décroissante */
  colors: ColorFrequencyItem[]
  /** Fréquence totale du bucket */
  totalFreq: number
}

// ============================================================================
// Fonctions de sélection
// ============================================================================

/**
 * Sélection par fréquence avec diversité de teinte
 *
 * En mode 0 (16 couleurs), privilégie la diversité des teintes pour éviter
 * d'avoir trop de nuances d'une même couleur.
 *
 * @param colorFrequency - Couleurs candidates triées par fréquence
 * @param selectedConverted - Couleurs déjà sélectionnées (modifié in-place)
 * @param result - Indices sélectionnés (modifié in-place)
 * @param frequencyBudget - Nombre max de couleurs à sélectionner
 * @param targetColors - Nombre total de couleurs cible (pour détecter mode 0 vs 1-2)
 * @param calculateDistance - Fonction de distance RGB
 */
export function selectFrequentColorsWithDiversity(
  colorFrequency: ColorFrequencyItem[],
  selectedConverted: Vector[],
  result: number[],
  frequencyBudget: number,
  targetColors: number | undefined,
  calculateDistance: DistanceFunction
): void {
  // Distance minimale adaptative selon la taille de la palette cible
  const minDistance =
    targetColors && targetColors <= CPC_MODE_1_MAX_COLORS
      ? MIN_RGB_DISTANCE_MODE_1_2
      : MIN_RGB_DISTANCE_MODE_0

  // Pour le mode 0, également exiger une diversité de teinte
  const isMode0 = targetColors && targetColors > CPC_MODE_1_MAX_COLORS
  const minHueDistance = MIN_HUE_DISTANCE_MODE_0

  for (
    let i = 1;
    i < colorFrequency.length && result.length < frequencyBudget;
    i++
  ) {
    const candidateConverted = colorFrequency[i].converted
    let isDiverse = true

    if (isMode0) {
      // Mode 0: vérifier aussi la diversité de teinte pour couleurs saturées
      const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
      const candidateSat = calculateSaturation(candidateConverted)

      // Pour les couleurs saturées (pas les gris), vérifier la diversité de teinte
      if (candidateSat > SATURATION_THRESHOLD_HIGH && candidateHue >= 0) {
        for (const selectedColor of selectedConverted) {
          const selectedSat = calculateSaturation(selectedColor)

          // Si la couleur sélectionnée est aussi saturée, vérifier la teinte
          if (selectedSat > SATURATION_THRESHOLD_HIGH) {
            const selectedHue = calculateHue(selectedColor, DELTA_MIN_FOR_HUE)
            const hueDistance = calculateHueDistance(candidateHue, selectedHue)

            // Si teintes trop proches ET distance RGB aussi proche, rejeter
            if (hueDistance < minHueDistance) {
              const rgbDistance = calculateDistance(
                candidateConverted,
                selectedColor
              )
              if (rgbDistance < minDistance * 2) {
                isDiverse = false
                break
              }
            }
          }
        }
      }
    }

    // Vérifier aussi la distance RGB classique
    if (isDiverse) {
      for (const selectedColor of selectedConverted) {
        if (
          calculateDistance(candidateConverted, selectedColor) < minDistance
        ) {
          isDiverse = false
          break
        }
      }
    }

    if (isDiverse) {
      result.push(colorFrequency[i].index)
      selectedConverted.push(candidateConverted)
    }
  }
}

/**
 * Sélection MaxMin Distance pour compléter la palette
 *
 * En mode 0, privilégie la diversité de teinte pour maximiser
 * la couverture des couleurs.
 *
 * @param colorFrequency - Couleurs candidates
 * @param selectedConverted - Couleurs déjà sélectionnées (modifié in-place)
 * @param result - Indices sélectionnés (modifié in-place)
 * @param targetColors - Nombre total de couleurs cible
 * @param calculateDistance - Fonction de distance RGB
 */
export function selectMaxMinDistanceColors(
  colorFrequency: ColorFrequencyItem[],
  selectedConverted: Vector[],
  result: number[],
  targetColors: number,
  calculateDistance: DistanceFunction
): void {
  const remaining = colorFrequency.filter((c) => !result.includes(c.index))
  const additionalColors = targetColors - result.length
  const isMode0 = targetColors > CPC_MODE_1_MAX_COLORS

  for (let i = 0; i < additionalColors && remaining.length > 0; i++) {
    let maxScore = -1
    let bestIndex = -1

    for (let j = 0; j < remaining.length; j++) {
      const candidateConverted = remaining[j].converted

      // Distance RGB minimale
      let minRGBDistance = Infinity
      for (const selectedColor of selectedConverted) {
        const distance = calculateDistance(candidateConverted, selectedColor)
        minRGBDistance = Math.min(minRGBDistance, distance)
      }

      let score = minRGBDistance

      // En mode 0, ajouter un bonus pour la diversité de teinte
      if (isMode0) {
        const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
        const candidateSat = calculateSaturation(candidateConverted)

        // Pour les couleurs saturées, calculer la distance de teinte minimale
        if (candidateSat > SATURATION_THRESHOLD_FOR_HUE && candidateHue >= 0) {
          let minHueDistanceVal = 360

          for (const selectedColor of selectedConverted) {
            const selectedSat = calculateSaturation(selectedColor)

            if (selectedSat > SATURATION_THRESHOLD_FOR_HUE) {
              const selectedHue = calculateHue(selectedColor, DELTA_MIN_FOR_HUE)
              const hueDistance = calculateHueDistance(
                candidateHue,
                selectedHue
              )
              minHueDistanceVal = Math.min(minHueDistanceVal, hueDistance)
            }
          }

          // Bonus pour les teintes très différentes
          // Normaliser minHueDistance (0-180) pour être comparable à minRGBDistance
          const hueBonus =
            (minHueDistanceVal / HUE_HALF_RANGE) *
            HUE_BONUS_NORMALIZATION *
            HUE_BONUS_WEIGHT
          score = minRGBDistance + hueBonus
        }
      }

      if (score > maxScore) {
        maxScore = score
        bestIndex = j
      }
    }

    if (bestIndex >= 0) {
      result.push(remaining[bestIndex].index)
      selectedConverted.push(remaining[bestIndex].converted)
      remaining.splice(bestIndex, 1)
    }
  }
}

/**
 * Crée des buckets de teinte pour regrouper les couleurs par famille
 *
 * Utilise des buckets de 45° (~8 familles principales + gris)
 *
 * @param colorFrequency - Couleurs candidates
 * @returns Map des buckets avec leurs couleurs
 */
export function createHueBuckets(
  colorFrequency: ColorFrequencyItem[]
): Map<number | 'gray', ColorFrequencyItem[]> {
  const hueBuckets = new Map<number | 'gray', ColorFrequencyItem[]>()

  for (const candidate of colorFrequency) {
    const sat = calculateSaturation(candidate.converted)
    const hue = calculateHue(candidate.converted, DELTA_MIN_FOR_HUE)

    // Buckets pour avoir ~8 familles principales
    const bucketKey: number | 'gray' =
      sat > SATURATION_THRESHOLD_FOR_HUE && hue >= 0
        ? Math.floor(hue / HUE_BUCKET_SIZE_DEGREES)
        : 'gray'

    if (!hueBuckets.has(bucketKey)) {
      hueBuckets.set(bucketKey, [])
    }
    hueBuckets.get(bucketKey)!.push(candidate)
  }

  return hueBuckets
}

/**
 * Trie les buckets par fréquence totale décroissante
 *
 * @param hueBuckets - Map des buckets
 * @returns Array de HueBucket triés
 */
export function sortBucketsByFrequency(
  hueBuckets: Map<number | 'gray', ColorFrequencyItem[]>
): HueBucket[] {
  return Array.from(hueBuckets.entries())
    .map(([bucket, colors]) => ({
      bucket,
      colors: [...colors].sort((a, b) => b.frequency - a.frequency),
      totalFreq: colors.reduce((sum, c) => sum + c.frequency, 0)
    }))
    .sort((a, b) => b.totalFreq - a.totalFreq)
}

/**
 * Sélectionne le meilleur représentant de chaque bucket de teinte
 *
 * @param sortedBuckets - Buckets triés par fréquence
 * @param maxRepresentatives - Nombre max de représentants
 * @returns Array des représentants sélectionnés
 */
export function selectBucketRepresentatives(
  sortedBuckets: HueBucket[],
  maxRepresentatives: number
): ColorFrequencyItem[] {
  const representatives: ColorFrequencyItem[] = []

  for (const { colors } of sortedBuckets) {
    if (representatives.length < maxRepresentatives && colors.length > 0) {
      representatives.push(colors[0])
    }
  }

  return representatives
}

/**
 * Détermine si on est en mode 0 (plus de 4 couleurs)
 *
 * @param targetColors - Nombre de couleurs cible
 * @returns true si mode 0, false si mode 1-2
 */
export function isMode0(targetColors: number): boolean {
  return targetColors > CPC_MODE_1_MAX_COLORS
}

/**
 * Calcule la distance RGB minimale requise selon le mode
 *
 * @param targetColors - Nombre de couleurs cible
 * @returns Distance minimale
 */
export function getMinRGBDistance(targetColors: number): number {
  return targetColors <= CPC_MODE_1_MAX_COLORS
    ? MIN_RGB_DISTANCE_MODE_1_2
    : MIN_RGB_DISTANCE_MODE_0
}
