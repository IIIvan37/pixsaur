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

import { adapterLogger } from '@/core'
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
}

/** Helper pour formater une couleur RGB */
function formatRGB(color: Vector): string {
  return `RGB(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])})`
}

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

/** Distance de teinte minimale pour mode 0 (degrés) - augmenté pour plus de diversité */
export const MIN_HUE_DISTANCE_MODE_0 = 35

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

/** Seuil de Value (HSV) pour considérer une couleur comme "claire" */
export const VALUE_THRESHOLD_BRIGHT = 0.5

/** Nombre minimum de couleurs claires parmi les représentants de bucket */
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

  adapterLogger.info('[FreqDiversity] Starting selection', {
    candidates: colorFrequency.length,
    alreadySelected: selectedConverted.length,
    budget: frequencyBudget,
    minRGBDistance: minDistance,
    minHueDistance,
    isMode0
  })

  let accepted = 0
  let rejectedHue = 0
  let rejectedRGB = 0

  for (
    let i = 1;
    i < colorFrequency.length && result.length < frequencyBudget;
    i++
  ) {
    const candidateConverted = colorFrequency[i].converted
    const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
    const candidateSat = calculateSaturation(candidateConverted)
    let isDiverse = true
    let rejectReason = ''

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
                rejectReason = `hue too close: ${formatRGB(candidateConverted)} (hue=${candidateHue.toFixed(0)}°) vs ${formatRGB(selectedColor)} (hue=${selectedHue.toFixed(0)}°), hueDist=${hueDistance.toFixed(0)}° < ${minHueDistance}°`
                rejectedHue++
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
          rejectReason = `RGB too close: ${formatRGB(candidateConverted)} vs ${formatRGB(selectedColor)}, dist=${rgbDist.toFixed(0)} < ${minDistance}`
          rejectedRGB++
          break
        }
      }
    }

    if (isDiverse) {
      result.push(colorFrequency[i].index)
      selectedConverted.push(candidateConverted)
      accepted++
      adapterLogger.info(
        `[FreqDiversity] ACCEPTED #${accepted}: ${formatRGB(candidateConverted)} hue=${candidateHue.toFixed(0)}° sat=${candidateSat.toFixed(2)} freq=${colorFrequency[i].frequency.toFixed(4)}`
      )
    } else {
      adapterLogger.info(`[FreqDiversity] REJECTED: ${rejectReason}`)
    }
  }

  adapterLogger.info('[FreqDiversity] Summary', {
    accepted,
    rejectedHue,
    rejectedRGB,
    totalSelected: result.length
  })
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
  const usedMegaFamilies = new Set<number>() // Méga-familles déjà utilisées

  // Définir les méga-familles (regroupement de 2 buckets adjacents = 90°)
  // Bucket 0-1 (0-90°) = rouge/orange/jaune
  // Bucket 2-3 (90-180°) = vert/cyan
  // Bucket 4-5 (180-270°) = cyan/bleu
  // Bucket 6-7 (270-360°) = violet/magenta/rouge
  const getMegaFamily = (bucket: number | 'gray'): number => {
    if (bucket === 'gray') return -1 // Gray est sa propre famille
    return Math.floor((bucket as number) / 2) // 0-1→0, 2-3→1, 4-5→2, 6-7→3
  }

  // Phase 1: Sélectionner le plus fréquent de chaque bucket, mais limiter les méga-familles
  for (let i = 0; i < sortedBuckets.length; i++) {
    const { bucket, colors } = sortedBuckets[i]
    if (representatives.length >= maxRepresentatives || colors.length === 0)
      continue

    const megaFamily = getMegaFamily(bucket)

    // Gray peut avoir plusieurs représentants (nuances de gris importantes)
    // Les autres méga-familles : max 1 représentant dans les 8 premiers
    if (megaFamily !== -1 && usedMegaFamilies.has(megaFamily)) {
      adapterLogger.info(
        `[BucketReps] SKIP bucket ${bucket} - mega-family ${megaFamily} already represented`
      )
      continue
    }

    representatives.push(colors[0])
    bucketIndices.push(i)
    if (megaFamily !== -1) {
      usedMegaFamilies.add(megaFamily)
    }
  }

  adapterLogger.info(
    `[BucketReps] Selected ${representatives.length} representatives from ${usedMegaFamilies.size} mega-families`
  )

  // Compter les couleurs claires parmi les représentants
  const brightCount = representatives.filter(
    (rep) => calculateValue(rep.converted) >= VALUE_THRESHOLD_BRIGHT
  ).length

  adapterLogger.info(
    `[Mode 0] Lightness check: ${brightCount}/${representatives.length} bright (threshold=${VALUE_THRESHOLD_BRIGHT})`
  )

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
        const oldColor = representatives[repIndex]
        const [r1, g1, b1] = oldColor.converted
        const [r2, g2, b2] = brightAlternative.converted
        const oldValue = calculateValue(oldColor.converted)
        const newValue = calculateValue(brightAlternative.converted)

        adapterLogger.info(
          `[Mode 0] Lightness swap in bucket ${bucket.bucket}: ` +
            `RGB(${Math.round(r1)}, ${Math.round(g1)}, ${Math.round(b1)}) V=${oldValue.toFixed(2)} -> ` +
            `RGB(${Math.round(r2)}, ${Math.round(g2)}, ${Math.round(b2)}) V=${newValue.toFixed(2)}`
        )

        representatives[repIndex] = brightAlternative
        replacements++
      }
    }

    if (replacements > 0) {
      adapterLogger.info(
        `[Mode 0] Lightness diversity: swapped ${replacements} dark representatives for brighter alternatives`
      )
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
