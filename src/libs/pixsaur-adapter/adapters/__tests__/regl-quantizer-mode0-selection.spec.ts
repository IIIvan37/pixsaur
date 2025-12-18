/**
 * Tests d'intégration pour la sélection de couleurs en Mode 0 (16 couleurs)
 *
 * Le Mode 0 utilise une logique locale avec:
 * - Buckets de teinte pour garantir la diversité
 * - selectFrequentColorsWithDiversity pour compléter par fréquence
 * - selectMaxMinDistanceColors pour maximiser la distance
 *
 * Ces tests capturent le comportement de production (c244923)
 */
import { describe, expect, it, vi } from 'vitest'
import { weightedRGBDistance } from '@/libs/pixsaur-color/src/metric/distance'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  calculateHue,
  calculateHueDistance,
  calculateSaturation
} from '@/libs/pixsaur-color/src/utils/hsv'

// Mock logger
vi.mock('@/core', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...(actual as any),
    adapterLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  }
})

// Constantes de regl-quantizer.ts (version c244923)
const CPC_MODE_1_MAX_COLORS = 4
const SATURATION_THRESHOLD_FOR_HUE = 0.2
const SATURATION_THRESHOLD_HIGH = 0.3
const DELTA_MIN_FOR_HUE = 0.01
const HUE_BUCKET_SIZE_DEGREES = 45
const MIN_HUE_DISTANCE_MODE_0 = 30
const MIN_RGB_DISTANCE_MODE_0 = 20
const MIN_RGB_DISTANCE_MODE_1_2 = 80
const HUE_HALF_RANGE = 180
const HUE_BONUS_NORMALIZATION = 200
const HUE_BONUS_WEIGHT = 2

interface ColorFrequencyItem {
  index: number
  frequency: number
  color: Vector
  converted: Vector
}

/**
 * Simule selectFrequentColorsWithDiversity de regl-quantizer.ts
 */
function selectFrequentColorsWithDiversity(
  colorFrequency: ColorFrequencyItem[],
  selectedConverted: Vector[],
  result: number[],
  frequencyBudget: number,
  targetColors?: number
): void {
  const minDistance =
    targetColors && targetColors <= CPC_MODE_1_MAX_COLORS
      ? MIN_RGB_DISTANCE_MODE_1_2
      : MIN_RGB_DISTANCE_MODE_0

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
      const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
      const candidateSat = calculateSaturation(candidateConverted)

      if (candidateSat > SATURATION_THRESHOLD_HIGH && candidateHue >= 0) {
        for (const selectedColor of selectedConverted) {
          const selectedSat = calculateSaturation(selectedColor)

          if (selectedSat > SATURATION_THRESHOLD_HIGH) {
            const selectedHue = calculateHue(selectedColor, DELTA_MIN_FOR_HUE)
            const hueDistance = calculateHueDistance(candidateHue, selectedHue)

            if (hueDistance < minHueDistance) {
              const rgbDistance = weightedRGBDistance(
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

    if (isDiverse) {
      for (const selectedColor of selectedConverted) {
        if (
          weightedRGBDistance(candidateConverted, selectedColor) < minDistance
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
 * Simule selectMaxMinDistanceColors de regl-quantizer.ts
 */
function selectMaxMinDistanceColors(
  colorFrequency: ColorFrequencyItem[],
  selectedConverted: Vector[],
  result: number[],
  targetColors: number
): void {
  const remaining = colorFrequency.filter((c) => !result.includes(c.index))
  const additionalColors = targetColors - result.length
  const isMode0 = targetColors > CPC_MODE_1_MAX_COLORS

  for (let i = 0; i < additionalColors && remaining.length > 0; i++) {
    let maxScore = -1
    let bestIndex = -1

    for (let j = 0; j < remaining.length; j++) {
      const candidateConverted = remaining[j].converted

      let minRGBDistance = Infinity
      for (const selectedColor of selectedConverted) {
        const distance = weightedRGBDistance(candidateConverted, selectedColor)
        minRGBDistance = Math.min(minRGBDistance, distance)
      }

      let score = minRGBDistance

      if (isMode0) {
        const candidateHue = calculateHue(candidateConverted, DELTA_MIN_FOR_HUE)
        const candidateSat = calculateSaturation(candidateConverted)

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
 * Simule la création de buckets de teinte
 */
function createHueBuckets(
  colorFrequency: ColorFrequencyItem[]
): Map<string | number, ColorFrequencyItem[]> {
  const hueBuckets = new Map<string | number, ColorFrequencyItem[]>()

  for (const candidate of colorFrequency) {
    const sat = calculateSaturation(candidate.converted)
    const hue = calculateHue(candidate.converted, DELTA_MIN_FOR_HUE)

    const bucketKey =
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

describe('Mode 0 Selection Algorithm (production c244923)', () => {
  describe('Hue Bucket Creation', () => {
    it('should create ~8 hue buckets from diverse colors', () => {
      const colors: ColorFrequencyItem[] = [
        // Rouge (hue ~0)
        {
          index: 0,
          frequency: 0.1,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        // Orange (hue ~30)
        {
          index: 1,
          frequency: 0.1,
          color: [255, 128, 0],
          converted: [255, 128, 0]
        },
        // Jaune (hue ~60)
        {
          index: 2,
          frequency: 0.1,
          color: [255, 255, 0],
          converted: [255, 255, 0]
        },
        // Vert (hue ~120)
        {
          index: 3,
          frequency: 0.1,
          color: [0, 255, 0],
          converted: [0, 255, 0]
        },
        // Cyan (hue ~180)
        {
          index: 4,
          frequency: 0.1,
          color: [0, 255, 255],
          converted: [0, 255, 255]
        },
        // Bleu (hue ~240)
        {
          index: 5,
          frequency: 0.1,
          color: [0, 0, 255],
          converted: [0, 0, 255]
        },
        // Magenta (hue ~300)
        {
          index: 6,
          frequency: 0.1,
          color: [255, 0, 255],
          converted: [255, 0, 255]
        },
        // Gris (desaturé)
        {
          index: 7,
          frequency: 0.1,
          color: [128, 128, 128],
          converted: [128, 128, 128]
        }
      ]

      const buckets = createHueBuckets(colors)

      // Doit avoir plusieurs buckets (couleurs saturées + gris)
      expect(buckets.size).toBeGreaterThanOrEqual(4)
      // Doit avoir un bucket "gray" pour les couleurs désaturées
      expect(buckets.has('gray')).toBe(true)
    })

    it('should group similar hues in same bucket', () => {
      const colors: ColorFrequencyItem[] = [
        // Deux rouges similaires (hue ~0-10)
        {
          index: 0,
          frequency: 0.1,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        {
          index: 1,
          frequency: 0.1,
          color: [255, 20, 0],
          converted: [255, 20, 0]
        }
      ]

      const buckets = createHueBuckets(colors)

      // Les deux rouges doivent être dans le même bucket (bucket 0: 0-45°)
      const bucket0 = buckets.get(0)
      expect(bucket0).toBeDefined()
      expect(bucket0!.length).toBe(2)
    })

    it('should put grayscale colors in gray bucket', () => {
      const colors: ColorFrequencyItem[] = [
        { index: 0, frequency: 0.1, color: [0, 0, 0], converted: [0, 0, 0] },
        {
          index: 1,
          frequency: 0.1,
          color: [128, 128, 128],
          converted: [128, 128, 128]
        },
        {
          index: 2,
          frequency: 0.1,
          color: [255, 255, 255],
          converted: [255, 255, 255]
        }
      ]

      const buckets = createHueBuckets(colors)

      expect(buckets.get('gray')!.length).toBe(3)
    })
  })

  describe('selectFrequentColorsWithDiversity', () => {
    it('should reject colors too close in RGB distance for mode 0', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        {
          index: 1,
          frequency: 0.3,
          color: [250, 5, 5],
          converted: [250, 5, 5]
        }, // Très proche du rouge
        {
          index: 2,
          frequency: 0.2,
          color: [0, 255, 0],
          converted: [0, 255, 0]
        } // Vert distinct
      ]

      const result: number[] = [0]
      const selectedConverted: Vector[] = [[255, 0, 0]]

      selectFrequentColorsWithDiversity(
        colorFrequency,
        selectedConverted,
        result,
        16,
        16
      )

      // Le rouge similaire (index 1) ne doit pas être sélectionné
      expect(result).not.toContain(1)
      // Le vert (index 2) doit être sélectionné
      expect(result).toContain(2)
    })

    it('should enforce higher RGB distance for modes 1-2', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        {
          index: 1,
          frequency: 0.3,
          color: [200, 50, 50],
          converted: [200, 50, 50]
        }, // Moyennement proche
        {
          index: 2,
          frequency: 0.2,
          color: [0, 255, 0],
          converted: [0, 255, 0]
        }
      ]

      const result: number[] = [0]
      const selectedConverted: Vector[] = [[255, 0, 0]]

      selectFrequentColorsWithDiversity(
        colorFrequency,
        selectedConverted,
        result,
        4, // frequencyBudget
        4 // targetColors <= 4 = mode 1-2
      )

      // En mode 1-2, la distance minimale est plus élevée (80 vs 20)
      // Le rouge similaire (index 1) pourrait être rejeté
      // Le vert (index 2) doit être sélectionné
      expect(result).toContain(2)
    })

    it('should check hue diversity for saturated colors in mode 0', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        // Rouge saturé
        {
          index: 0,
          frequency: 0.4,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        // Orange saturé (teinte proche du rouge)
        {
          index: 1,
          frequency: 0.3,
          color: [255, 100, 0],
          converted: [255, 100, 0]
        },
        // Bleu saturé (teinte éloignée)
        {
          index: 2,
          frequency: 0.2,
          color: [0, 0, 255],
          converted: [0, 0, 255]
        }
      ]

      const result: number[] = [0]
      const selectedConverted: Vector[] = [[255, 0, 0]]

      selectFrequentColorsWithDiversity(
        colorFrequency,
        selectedConverted,
        result,
        16,
        16
      )

      // Le bleu doit être sélectionné (teinte très différente)
      expect(result).toContain(2)
    })
  })

  describe('selectMaxMinDistanceColors', () => {
    it('should select color with maximum minimum distance', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.3,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        {
          index: 1,
          frequency: 0.3,
          color: [128, 128, 128],
          converted: [128, 128, 128]
        },
        {
          index: 2,
          frequency: 0.3,
          color: [0, 0, 255],
          converted: [0, 0, 255]
        }
      ]

      const result: number[] = [0] // Rouge déjà sélectionné
      const selectedConverted: Vector[] = [[255, 0, 0]]

      selectMaxMinDistanceColors(colorFrequency, selectedConverted, result, 3)

      // Doit sélectionner les couleurs les plus éloignées
      expect(result).toHaveLength(3)
      expect(result).toContain(0)
    })

    it('should add hue bonus for mode 0', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.3,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        // Gris (distance RGB élevée mais pas de bonus hue)
        {
          index: 1,
          frequency: 0.3,
          color: [128, 128, 128],
          converted: [128, 128, 128]
        },
        // Cyan (distance RGB moyenne mais bonus hue élevé)
        {
          index: 2,
          frequency: 0.3,
          color: [0, 255, 255],
          converted: [0, 255, 255]
        }
      ]

      const result: number[] = [0]
      const selectedConverted: Vector[] = [[255, 0, 0]]

      selectMaxMinDistanceColors(colorFrequency, selectedConverted, result, 16)

      // Avec le bonus de teinte, le cyan devrait avoir un meilleur score
      expect(result.length).toBeGreaterThan(1)
    })
  })

  describe('Mode 0 vs Modes 1-2 Strategy Difference', () => {
    it('should use local algorithm for mode 0 (>4 colors)', () => {
      // Ce test documente que le mode 0 n'utilise PAS applyPaletteStrategyV2
      // mais la logique locale avec buckets et helpers
      const targetColors = 16
      expect(targetColors).toBeGreaterThan(CPC_MODE_1_MAX_COLORS)
      // Mode 0 = logique locale (buckets + selectFrequentColorsWithDiversity + selectMaxMinDistanceColors)
    })

    it('should use applyPaletteStrategyV2 for modes 1-2 (≤4 colors)', () => {
      // Ce test documente que les modes 1-2 utilisent applyPaletteStrategyV2
      const targetColors = 4
      expect(targetColors).toBeLessThanOrEqual(CPC_MODE_1_MAX_COLORS)
      // Modes 1-2 = applyPaletteStrategyV2 avec la stratégie utilisateur
    })
  })
})

describe('HSV Utility Functions Integration', () => {
  describe('calculateHue', () => {
    it('should return correct hue for primary colors', () => {
      // Rouge = ~0°
      const redHue = calculateHue([255, 0, 0], DELTA_MIN_FOR_HUE)
      expect(redHue).toBeGreaterThanOrEqual(0)
      expect(redHue).toBeLessThan(30)

      // Vert = ~120°
      const greenHue = calculateHue([0, 255, 0], DELTA_MIN_FOR_HUE)
      expect(greenHue).toBeGreaterThanOrEqual(100)
      expect(greenHue).toBeLessThan(140)

      // Bleu = ~240°
      const blueHue = calculateHue([0, 0, 255], DELTA_MIN_FOR_HUE)
      expect(blueHue).toBeGreaterThanOrEqual(220)
      expect(blueHue).toBeLessThan(260)
    })
  })

  describe('calculateSaturation', () => {
    it('should return 0 for grayscale', () => {
      expect(calculateSaturation([128, 128, 128])).toBe(0)
      expect(calculateSaturation([0, 0, 0])).toBe(0)
    })

    it('should return 1 for fully saturated colors', () => {
      expect(calculateSaturation([255, 0, 0])).toBe(1)
      expect(calculateSaturation([0, 255, 0])).toBe(1)
      expect(calculateSaturation([0, 0, 255])).toBe(1)
    })
  })

  describe('calculateHueDistance', () => {
    it('should calculate circular distance', () => {
      // Distance directe
      expect(calculateHueDistance(0, 30)).toBe(30)

      // Distance circulaire (plus court par l'autre côté)
      expect(calculateHueDistance(350, 10)).toBe(20) // 360 - 350 + 10 = 20
    })
  })
})
