/**
 * Sélection de couleurs « mode 0 hue diversity » — source unique partagée.
 *
 * Deux chemins de production utilisent cet algorithme avec des réglages
 * volontairement différents, encodés dans deux presets :
 * - le quantizer GPU (pixsaur-adapter) : CPC_ADAPTER_MODE0_TUNING
 *   (comportement de production c244923, surchargeable par le slider
 *   de diversité via getColorDiversityParams)
 * - la stratégie `mode0-hue-diversity` (palette-strategies-v2) :
 *   STRATEGY_V2_MODE0_TUNING
 *
 * IMPORTANT: les presets reproduisent bit-à-bit les deux comportements
 * historiques — ne pas « harmoniser » les constantes entre eux.
 */

import type { Vector } from '../type'
import {
  calculateHue,
  calculateHueDistance,
  calculateSaturation,
  calculateValue
} from '../utils/hsv'

// ============================================================================
// Constantes de configuration (héritées du quantizer GPU)
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
export const MIN_BRIGHT_BUCKET_REPRESENTATIVES = 2

// ============================================================================
// Types
// ============================================================================

/** Représente une couleur candidate avec ses métadonnées */
export interface ColorCandidate {
  /** Index dans la palette de base */
  index: number
  /** Fréquence d'apparition (0-1) */
  frequency: number
  /** Couleur originale RGB */
  color: Vector
  /** Couleur convertie/mappée RGB */
  converted: Vector
}

/** Alias historique côté pixsaur-adapter */
export type ColorFrequencyItem = ColorCandidate

/** Fonction de calcul de distance entre deux couleurs */
export type DistanceFunction = (a: Vector, b: Vector) => number

/** Bucket de teinte avec ses couleurs */
export interface HueBucket {
  /** Clé du bucket (numéro ou 'gray') */
  bucket: number | 'gray'
  /** Couleurs triées par fréquence décroissante */
  colors: ColorCandidate[]
  /** Fréquence totale du bucket */
  totalFreq: number
}

// ============================================================================
// Tuning (presets historiques)
// ============================================================================

/**
 * Réglages de l'algorithme. Chaque preset reproduit exactement un
 * comportement historique — voir l'en-tête du module.
 */
export interface Mode0HueDiversityTuning {
  /** Distance RGB minimale (grandes palettes / mode 0) */
  minRgbDistance: number
  /** Distance RGB minimale pour petites palettes (modes 1-2); null = pas de distinction */
  smallPaletteMinRgbDistance: number | null
  /** Distance de teinte minimale en degrés */
  minHueDistance: number
  /** Seuil de saturation du contrôle de teinte (sélection par fréquence) */
  freqHueSatThreshold: number
  /** Le contrôle de teinte (fréquence) ne s'applique qu'aux grandes palettes */
  freqHueCheckLargePaletteOnly: boolean
  /** Seuil de saturation du bonus de teinte (MaxMin) */
  maxMinSatThreshold: number
  /** Le bonus de teinte (MaxMin) ne s'applique qu'aux grandes palettes */
  maxMinHueBonusLargePaletteOnly: boolean
  /** Taille des buckets de teinte en degrés */
  hueBucketSize: number
  /** Seuil de saturation pour le bucketing */
  bucketSatThreshold: number
  /** Distance de teinte — les deux historiques divergent sur les teintes
   * achromatiques (-1) : hsv.calculateHueDistance retourne 180,
   * wrapHueDistance n'a pas de garde */
  hueDistance: (hue1: number, hue2: number) => number
}

/**
 * Distance de teinte circulaire SANS garde achromatique.
 * Conservée pour la fidélité bit-à-bit avec la stratégie v2 historique :
 * une teinte -1 (achromatique) participe au calcul telle quelle.
 */
export function wrapHueDistance(hue1: number, hue2: number): number {
  const diff = Math.abs(hue1 - hue2)
  return Math.min(diff, 360 - diff)
}

/** Comportement du quantizer GPU (pixsaur-adapter, production c244923) */
export const CPC_ADAPTER_MODE0_TUNING: Mode0HueDiversityTuning = {
  minRgbDistance: MIN_RGB_DISTANCE_MODE_0,
  smallPaletteMinRgbDistance: MIN_RGB_DISTANCE_MODE_1_2,
  minHueDistance: MIN_HUE_DISTANCE_MODE_0,
  freqHueSatThreshold: 0.15,
  freqHueCheckLargePaletteOnly: true,
  maxMinSatThreshold: SATURATION_THRESHOLD_FOR_HUE,
  maxMinHueBonusLargePaletteOnly: true,
  hueBucketSize: HUE_BUCKET_SIZE_DEGREES,
  bucketSatThreshold: SATURATION_THRESHOLD_FOR_HUE,
  hueDistance: calculateHueDistance
}

/** Comportement de la stratégie `mode0-hue-diversity` (palette-strategies-v2) */
export const STRATEGY_V2_MODE0_TUNING: Mode0HueDiversityTuning = {
  minRgbDistance: 20,
  smallPaletteMinRgbDistance: null,
  minHueDistance: 30,
  freqHueSatThreshold: 0.3,
  freqHueCheckLargePaletteOnly: false,
  maxMinSatThreshold: 0.2,
  maxMinHueBonusLargePaletteOnly: false,
  hueBucketSize: 45,
  bucketSatThreshold: 0.2,
  hueDistance: wrapHueDistance
}

// ============================================================================
// Color Diversity Configuration (slider)
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
 * @param tuning - Preset de comportement (défaut: quantizer GPU)
 */
export function selectFrequentColorsWithDiversity(
  colorFrequency: ColorCandidate[],
  selectedConverted: Vector[],
  result: number[],
  frequencyBudget: number,
  targetColors: number | undefined,
  calculateDistance: DistanceFunction,
  diversityParams?: ColorDiversityParams,
  tuning: Mode0HueDiversityTuning = CPC_ADAPTER_MODE0_TUNING
): void {
  // Distance minimale adaptative selon la taille de la palette cible
  const useSmallPaletteDistance =
    tuning.smallPaletteMinRgbDistance !== null &&
    targetColors &&
    targetColors <= CPC_MODE_1_MAX_COLORS
  const minDistance = useSmallPaletteDistance
    ? (tuning.smallPaletteMinRgbDistance as number)
    : (diversityParams?.minRgbDistance ?? tuning.minRgbDistance)

  // Contrôle de teinte: toujours, ou seulement pour les grandes palettes (mode 0)
  const applyHueCheck = tuning.freqHueCheckLargePaletteOnly
    ? Boolean(targetColors && targetColors > CPC_MODE_1_MAX_COLORS)
    : true
  const minHueDistance =
    diversityParams?.minHueDistance ?? tuning.minHueDistance

  for (
    let i = 1;
    i < colorFrequency.length && result.length < frequencyBudget;
    i++
  ) {
    const candidateConverted = colorFrequency[i].converted
    const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
    const candidateSat = calculateSaturation(candidateConverted)
    let isDiverse = true

    if (
      applyHueCheck &&
      candidateSat > tuning.freqHueSatThreshold &&
      candidateHue >= 0
    ) {
      // Vérifier la diversité de teinte pour couleurs ayant une teinte identifiable
      for (const selectedColor of selectedConverted) {
        const selectedSat = calculateSaturation(selectedColor)

        // Si la couleur sélectionnée a aussi une teinte identifiable, vérifier
        if (selectedSat > tuning.freqHueSatThreshold) {
          const selectedHue = calculateHue(selectedColor, DELTA_MIN_FOR_HUE)
          const hueDistance = tuning.hueDistance(candidateHue, selectedHue)

          // Si teintes trop proches, rejeter (même si RGB différent)
          // Cela garantit que la palette couvre bien l'espace des teintes
          if (hueDistance < minHueDistance) {
            isDiverse = false
            break
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
 * @param tuning - Preset de comportement (défaut: quantizer GPU)
 */
export function selectMaxMinDistanceColors(
  colorFrequency: ColorCandidate[],
  selectedConverted: Vector[],
  result: number[],
  targetColors: number,
  calculateDistance: DistanceFunction,
  _diversityParams?: ColorDiversityParams,
  tuning: Mode0HueDiversityTuning = CPC_ADAPTER_MODE0_TUNING
): void {
  const remaining = colorFrequency.filter((c) => !result.includes(c.index))
  const additionalColors = targetColors - result.length
  const applyHueBonus = tuning.maxMinHueBonusLargePaletteOnly
    ? targetColors > CPC_MODE_1_MAX_COLORS
    : true

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

      // Ajouter un bonus pour la diversité de teinte
      if (applyHueBonus) {
        const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
        const candidateSat = calculateSaturation(candidateConverted)

        // Pour les couleurs saturées, calculer la distance de teinte minimale
        if (candidateSat > tuning.maxMinSatThreshold && candidateHue >= 0) {
          let minHueDistanceVal = 360

          for (const selectedColor of selectedConverted) {
            const selectedSat = calculateSaturation(selectedColor)

            if (selectedSat > tuning.maxMinSatThreshold) {
              const selectedHue = calculateHue(selectedColor, DELTA_MIN_FOR_HUE)
              const hueDistance = tuning.hueDistance(candidateHue, selectedHue)
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
 * @param colorFrequency - Couleurs candidates
 * @param diversityParams - Optional diversity parameters from slider
 * @param tuning - Preset de comportement (défaut: quantizer GPU)
 * @returns Map des buckets avec leurs couleurs
 */
export function createHueBuckets(
  colorFrequency: ColorCandidate[],
  diversityParams?: ColorDiversityParams,
  tuning: Mode0HueDiversityTuning = CPC_ADAPTER_MODE0_TUNING
): Map<number | 'gray', ColorCandidate[]> {
  const hueBuckets = new Map<number | 'gray', ColorCandidate[]>()
  const bucketSize = diversityParams?.hueBucketSize ?? tuning.hueBucketSize

  for (const candidate of colorFrequency) {
    const sat = calculateSaturation(candidate.converted)
    const hue = calculateHue(candidate.converted, DELTA_MIN_FOR_HUE)

    // Buckets pour avoir ~8-12 familles principales depending on diversity
    const bucketKey: number | 'gray' =
      sat > tuning.bucketSatThreshold && hue >= 0
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
  hueBuckets: Map<number | 'gray', ColorCandidate[]>
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
): ColorCandidate[] {
  const representatives: ColorCandidate[] = []

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
 * 1. Un représentant par bucket distinct pour garantir la diversité
 * 2. Assure un minimum de couleurs claires
 *
 * @param sortedBuckets - Buckets triés par fréquence
 * @param maxRepresentatives - Nombre max de représentants
 * @returns Array des représentants avec diversité de luminosité
 */
export function selectBucketRepresentativesWithLightness(
  sortedBuckets: HueBucket[],
  maxRepresentatives: number
): ColorCandidate[] {
  const representatives: ColorCandidate[] = []
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
 * @param tuning - Preset de comportement (défaut: quantizer GPU)
 * @returns Statistics about added/skipped representatives
 */
export function addBucketRepresentativesWithDistanceCheck(
  bucketRepresentatives: ColorCandidate[],
  _sortedBuckets: HueBucket[],
  result: number[],
  selectedConverted: Vector[],
  calculateDistance: DistanceFunction,
  tuning: Mode0HueDiversityTuning = CPC_ADAPTER_MODE0_TUNING
): AddRepresentativesResult {
  let added = 0
  let skipped = 0

  for (const rep of bucketRepresentatives) {
    if (result.includes(rep.index)) continue

    // Check distance with all already selected colors
    let tooClose = false
    const repHue = calculateHue(rep.converted, DELTA_MIN_FOR_HUE)
    const repSat = calculateSaturation(rep.converted)

    for (const existing of selectedConverted) {
      const dist = calculateDistance(rep.converted, existing)

      // RGB distance check
      if (dist < tuning.minRgbDistance) {
        tooClose = true
        skipped++
        break
      }

      // Hue distance check (for colors with identifiable hue)
      const existingSat = calculateSaturation(existing)
      if (
        repSat > tuning.freqHueSatThreshold &&
        repHue >= 0 &&
        existingSat > tuning.freqHueSatThreshold
      ) {
        const existingHue = calculateHue(existing, DELTA_MIN_FOR_HUE)
        if (existingHue >= 0) {
          const hueDist = tuning.hueDistance(repHue, existingHue)
          if (hueDist < tuning.minHueDistance) {
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
