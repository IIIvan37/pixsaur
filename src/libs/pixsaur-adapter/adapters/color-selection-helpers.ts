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
  calculateSaturation,
  calculateValue
} from '@/libs/pixsaur-color/src/utils/hsv'

// Ré-export des fonctions HSV pour utilisation dans regl-quantizer.ts
export {
  calculateHue,
  calculateHueDistance,
  calculateSaturation,
  calculateValue
} from '../../pixsaur-color/src/utils/hsv'

// ============================================================================
// Constantes de configuration
// ============================================================================

/** Nombre max de couleurs pour modes 1-2 (mode 0 = plus de 4 couleurs) */
export const CPC_MODE_1_MAX_COLORS = 4

/** Distance RGB minimale pour mode 0 (16 couleurs)
 * Valeur modérée pour permettre la diversité de teinte tout en évitant les quasi-doublons
 * 100 = environ 10 unités RGB par canal en moyenne */
export const MIN_RGB_DISTANCE_MODE_0 = 100

/** Distance RGB minimale pour modes 1-2 (2-4 couleurs) - contraste plus élevé */
export const MIN_RGB_DISTANCE_MODE_1_2 = 200

/** Distance de teinte minimale pour mode 0 (degrés) - réduit pour permettre plus de nuances */
export const MIN_HUE_DISTANCE_MODE_0 = 25

/** Seuil de saturation pour considérer une couleur comme "saturée" */
export const SATURATION_THRESHOLD_FOR_HUE = 0.2

/** Seuil de saturation élevé pour vérification de teinte */
export const SATURATION_THRESHOLD_HIGH = 0.3

/** Delta minimum pour calcul de teinte (évite les erreurs sur les gris) */
export const DELTA_MIN_FOR_HUE = 0.01

/** Taille des buckets de teinte en degrés (~12 familles: 360/30 = 12) */
export const HUE_BUCKET_SIZE_DEGREES = 30

/** Demi-range de teinte pour normalisation */
export const HUE_HALF_RANGE = 180

/** Facteur de normalisation du bonus de teinte */
export const HUE_BONUS_NORMALIZATION = 200

/** Poids du bonus de teinte dans le score MaxMin */
export const HUE_BONUS_WEIGHT = 2

/** Seuil de Value (HSV) pour considérer une couleur comme "claire" */
export const VALUE_THRESHOLD_BRIGHT = 0.5

/** Nombre minimum de couleurs claires parmi les représentants de bucket */

// ============================================================================
// Color Diversity Configuration
// ============================================================================

/**
 * Parameters derived from the color diversity slider (0-100)
 */
export interface ColorDiversityParams {
  /** Minimum hue distance in degrees (10-45) */
  minHueDistance: number
  /** Minimum RGB distance (50-150) */
  minRgbDistance: number
  /** Hue bucket size in degrees (20-45) */
  hueBucketSize: number
}

/**
 * Maps the color diversity slider (0-100) to internal quantization parameters.
 *
 * - 0 = "Similar shades": Allows more similar colors, prioritizes frequency
 * - 50 = "Balanced": Current default behavior
 * - 100 = "Distinct hues": Maximizes color variety
 *
 * @param diversity - Slider value from 0 to 100
 * @returns Parameters for color selection algorithms
 */
export function getColorDiversityParams(
  diversity: number
): ColorDiversityParams {
  // Clamp to 0-100
  const d = Math.max(0, Math.min(100, diversity))

  // Linear interpolation for each parameter
  // diversity 0 -> 100 maps to:
  // - minHueDistance: 10° -> 45° (low = allow similar hues, high = require distinct)
  // - minRgbDistance: 50 -> 150 (low = allow close RGB, high = require contrast)
  // - hueBucketSize: 45° -> 20° (low = fewer families, high = more families)

  const minHueDistance = 10 + (d / 100) * 35 // 10 to 45
  const minRgbDistance = 50 + (d / 100) * 100 // 50 to 150
  const hueBucketSize = 45 - (d / 100) * 25 // 45 to 20

  return {
    minHueDistance: Math.round(minHueDistance),
    minRgbDistance: Math.round(minRgbDistance),
    hueBucketSize: Math.round(hueBucketSize)
  }
}
export const MIN_BRIGHT_BUCKET_REPRESENTATIVES = 2

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
 * @param diversityParams - Optional diversity parameters from slider
 */
export function selectFrequentColorsWithDiversity(
  colorFrequency: ColorFrequencyItem[],
  selectedConverted: Vector[],
  result: number[],
  frequencyBudget: number,
  targetColors: number | undefined,
  calculateDistance: DistanceFunction,
  diversityParams?: ColorDiversityParams
): void {
  // Distance minimale adaptative selon la taille de la palette cible
  // Use diversity params if provided, otherwise use defaults
  const minDistance =
    targetColors && targetColors <= CPC_MODE_1_MAX_COLORS
      ? MIN_RGB_DISTANCE_MODE_1_2
      : (diversityParams?.minRgbDistance ?? MIN_RGB_DISTANCE_MODE_0)

  // Pour le mode 0, également exiger une diversité de teinte
  const isMode0 = targetColors && targetColors > CPC_MODE_1_MAX_COLORS
  const minHueDistance =
    diversityParams?.minHueDistance ?? MIN_HUE_DISTANCE_MODE_0

  for (
    let i = 1;
    i < colorFrequency.length && result.length < frequencyBudget;
    i++
  ) {
    const candidateConverted = colorFrequency[i].converted
    const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
    const candidateSat = calculateSaturation(candidateConverted)
    let isDiverse = true

    if (isMode0) {
      // Mode 0: vérifier la diversité de teinte pour couleurs ayant une teinte identifiable
      // Utiliser le même seuil que pour le compteur de bucket (0.08) pour cohérence
      // Cela inclut les jaunes/verts désaturés qui ont quand même une teinte visible
      const MIN_SAT_FOR_HUE_CHECK = 0.15
      if (candidateSat > MIN_SAT_FOR_HUE_CHECK && candidateHue >= 0) {
        for (const selectedColor of selectedConverted) {
          const selectedSat = calculateSaturation(selectedColor)

          // Si la couleur sélectionnée a aussi une teinte identifiable, vérifier
          if (selectedSat > MIN_SAT_FOR_HUE_CHECK) {
            const selectedHue = calculateHue(selectedColor, DELTA_MIN_FOR_HUE)
            if (selectedHue >= 0) {
              const hueDistance = calculateHueDistance(
                candidateHue,
                selectedHue
              )

              // Si teintes trop proches, rejeter (même si RGB différent)
              // Cela garantit que la palette couvre bien l'espace des teintes
              if (hueDistance < minHueDistance) {
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
        const rgbDist = calculateDistance(candidateConverted, selectedColor)
        if (rgbDist < minDistance) {
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
  calculateDistance: DistanceFunction,
  _diversityParams?: ColorDiversityParams
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
 * @param diversityParams - Optional diversity parameters from slider
 * @returns Map des buckets avec leurs couleurs
 */
export function createHueBuckets(
  colorFrequency: ColorFrequencyItem[],
  diversityParams?: ColorDiversityParams
): Map<number | 'gray', ColorFrequencyItem[]> {
  const hueBuckets = new Map<number | 'gray', ColorFrequencyItem[]>()
  const bucketSize = diversityParams?.hueBucketSize ?? HUE_BUCKET_SIZE_DEGREES

  for (const candidate of colorFrequency) {
    const sat = calculateSaturation(candidate.converted)
    const hue = calculateHue(candidate.converted, DELTA_MIN_FOR_HUE)

    // Buckets pour avoir ~8-12 familles principales depending on diversity
    const bucketKey: number | 'gray' =
      sat > SATURATION_THRESHOLD_FOR_HUE && hue >= 0
        ? Math.floor(hue / bucketSize)
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
 * Sélectionne les représentants de bucket avec diversité de luminosité
 *
 * Stratégie:
 * 1. Regroupe les buckets adjacents en "méga-familles" (ex: verts 45-135°)
 * 2. Ne prend qu'UN représentant par méga-famille pour garantir la diversité
 * 3. Assure un minimum de couleurs claires
 *
 * @param sortedBuckets - Buckets triés par fréquence
 * @param maxRepresentatives - Nombre max de représentants
 * @returns Array des représentants avec diversité de luminosité
 */
export function selectBucketRepresentativesWithLightness(
  sortedBuckets: HueBucket[],
  maxRepresentatives: number
): ColorFrequencyItem[] {
  const representatives: ColorFrequencyItem[] = []
  const bucketIndices: number[] = [] // Pour savoir de quel bucket vient chaque rep
  const usedBuckets = new Set<number | 'gray'>() // Buckets déjà utilisés

  // Phase 1: Sélectionner le plus fréquent de chaque bucket distinct
  // Avec 12 buckets (30° chacun), on couvre bien les 16 couleurs du mode 0
  // Buckets: 0=rouge, 1=orange, 2=jaune, 3=chartreuse, 4=vert, 5=cyan-vert,
  //          6=cyan, 7=bleu-cyan, 8=bleu, 9=violet, 10=magenta, 11=rose
  for (let i = 0; i < sortedBuckets.length; i++) {
    const { bucket, colors } = sortedBuckets[i]
    if (representatives.length >= maxRepresentatives || colors.length === 0)
      continue

    // Un représentant par bucket (pas de méga-familles)
    // Cela permet plus de diversité de teintes
    if (usedBuckets.has(bucket)) {
      continue
    }

    representatives.push(colors[0])
    bucketIndices.push(i)
    usedBuckets.add(bucket)
  }

  // Compter les couleurs claires parmi les représentants
  const brightCount = representatives.filter(
    (rep) => calculateValue(rep.converted) >= VALUE_THRESHOLD_BRIGHT
  ).length

  // Si on n'a pas assez de couleurs claires, essayer de remplacer des sombres
  if (brightCount < MIN_BRIGHT_BUCKET_REPRESENTATIVES) {
    const darkIndices: Array<{ repIndex: number; value: number }> = []

    // Trouver les représentants les plus sombres
    for (let i = 0; i < representatives.length; i++) {
      const value = calculateValue(representatives[i].converted)
      if (value < VALUE_THRESHOLD_BRIGHT) {
        darkIndices.push({ repIndex: i, value })
      }
    }

    // Trier par luminosité croissante (les plus sombres d'abord)
    darkIndices.sort((a, b) => a.value - b.value)

    // Pour chaque représentant sombre, chercher une alternative claire dans son bucket
    let replacements = 0
    const neededBright = MIN_BRIGHT_BUCKET_REPRESENTATIVES - brightCount

    for (const { repIndex } of darkIndices) {
      if (replacements >= neededBright) break

      const bucketIdx = bucketIndices[repIndex]
      const bucket = sortedBuckets[bucketIdx]

      // Chercher une couleur claire dans ce bucket (pas trop peu fréquente)
      const minFrequency = representatives[repIndex].frequency * 0.1 // Au moins 10% de la fréquence du top
      const brightAlternative = bucket.colors.find((c) => {
        const value = calculateValue(c.converted)
        return value >= VALUE_THRESHOLD_BRIGHT && c.frequency >= minFrequency
      })

      if (brightAlternative) {
        representatives[repIndex] = brightAlternative
        replacements++
      }
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

/**
 * Result type for addBucketRepresentativesWithDistanceCheck
 */
export interface AddRepresentativesResult {
  /** Number of representatives added */
  added: number
  /** Number of representatives skipped due to being too close */
  skipped: number
}

/**
 * Add bucket representatives to result while checking distance constraints
 *
 * Checks both RGB distance and hue distance to ensure diversity
 *
 * @param bucketRepresentatives - Representatives from bucket selection
 * @param sortedBuckets - Sorted buckets for logging context
 * @param result - Current result indices (modified in-place)
 * @param selectedConverted - Currently selected colors (modified in-place)
 * @param calculateDistance - Distance function
 * @returns Statistics about added/skipped representatives
 */
export function addBucketRepresentativesWithDistanceCheck(
  bucketRepresentatives: ColorFrequencyItem[],
  _sortedBuckets: HueBucket[],
  result: number[],
  selectedConverted: Vector[],
  calculateDistance: DistanceFunction
): AddRepresentativesResult {
  let added = 0
  let skipped = 0

  // Constants for distance checks
  const MIN_SAT_FOR_HUE_CHECK = 0.15

  for (const rep of bucketRepresentatives) {
    if (result.includes(rep.index)) continue

    // Check distance with all already selected colors
    let tooClose = false
    const repHue = calculateHue(rep.converted, DELTA_MIN_FOR_HUE)
    const repSat = calculateSaturation(rep.converted)

    for (const existing of selectedConverted) {
      const dist = calculateDistance(rep.converted, existing)

      // RGB distance check
      if (dist < MIN_RGB_DISTANCE_MODE_0) {
        tooClose = true
        skipped++
        break
      }

      // Hue distance check (for colors with identifiable hue)
      const existingSat = calculateSaturation(existing)
      if (
        repSat > MIN_SAT_FOR_HUE_CHECK &&
        repHue >= 0 &&
        existingSat > MIN_SAT_FOR_HUE_CHECK
      ) {
        const existingHue = calculateHue(existing, DELTA_MIN_FOR_HUE)
        if (existingHue >= 0) {
          const hueDist = calculateHueDistance(repHue, existingHue)
          if (hueDist < MIN_HUE_DISTANCE_MODE_0) {
            tooClose = true
            skipped++
            break
          }
        }
      }
    }

    if (!tooClose) {
      result.push(rep.index)
      selectedConverted.push(rep.converted)
      added++
    }
  }

  return { added, skipped }
}
