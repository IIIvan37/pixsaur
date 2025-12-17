import { describe, expect, it } from 'vitest'
import type { Vector } from '../type'
import {
  AVAILABLE_STRATEGIES,
  applyPaletteStrategyV2,
  type ColorCandidate,
  convertPreselectedToIndices,
  isValidPaletteStrategy,
  type PaletteStrategyName,
  selectByAdaptive,
  selectByBalancedScoreBalanced,
  selectByBalancedScoreMax,
  selectByCoverageAware,
  selectByDitheringAware,
  selectByDiversityFirstBalanced,
  selectByDiversityFirstMax,
  selectByExhaustiveContrast,
  selectByFrequencyBalanced,
  selectByFrequencyMax,
  selectByMode0HueDiversity,
  selectByPerceptualBalanced,
  selectByPerceptualMax
} from './palette-strategies-v2'

describe('palette-strategies-v2', () => {
  describe('convertPreselectedToIndices', () => {
    it('should convert preselected colors to their indices in base palette', () => {
      const basePalette: Vector[] = [
        [255, 0, 0], // 0: rouge
        [0, 255, 0], // 1: vert
        [0, 0, 255], // 2: bleu
        [255, 255, 0] // 3: jaune
      ]
      const preselected: Vector[] = [
        [0, 255, 0], // vert (index 1)
        [0, 0, 255] // bleu (index 2)
      ]

      const result = convertPreselectedToIndices(preselected, basePalette)

      expect(result).toEqual([1, 2])
    })

    it('should filter out colors not found in base palette', () => {
      const basePalette: Vector[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ]
      const preselected: Vector[] = [
        [0, 255, 0], // vert (index 1) - exists
        [128, 128, 128], // gris - does not exist
        [0, 0, 255] // bleu (index 2) - exists
      ]

      const result = convertPreselectedToIndices(preselected, basePalette)

      expect(result).toEqual([1, 2])
    })

    it('should return empty array when no preselected colors match', () => {
      const basePalette: Vector[] = [
        [255, 0, 0],
        [0, 255, 0]
      ]
      const preselected: Vector[] = [
        [128, 128, 128],
        [64, 64, 64]
      ]

      const result = convertPreselectedToIndices(preselected, basePalette)

      expect(result).toEqual([])
    })

    it('should handle empty preselected array', () => {
      const basePalette: Vector[] = [
        [255, 0, 0],
        [0, 255, 0]
      ]
      const preselected: Vector[] = []

      const result = convertPreselectedToIndices(preselected, basePalette)

      expect(result).toEqual([])
    })

    it('should handle duplicate preselected colors', () => {
      const basePalette: Vector[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ]
      const preselected: Vector[] = [
        [0, 255, 0], // vert (index 1)
        [0, 255, 0], // vert again (index 1)
        [0, 0, 255] // bleu (index 2)
      ]

      const result = convertPreselectedToIndices(preselected, basePalette)

      expect(result).toEqual([1, 1, 2]) // includes duplicates
    })
  })

  // Créer des candidats de test avec différentes caractéristiques
  const createTestCandidates = (): ColorCandidate[] => [
    {
      // Couleur fréquente, sombre, saturée (rouge)
      index: 0,
      frequency: 100,
      color: [200, 0, 0] as Vector,
      converted: [200, 0, 0] as Vector
    },
    {
      // Couleur moyenne fréquence, moyenne luminance (vert)
      index: 1,
      frequency: 50,
      color: [0, 150, 0] as Vector,
      converted: [0, 150, 0] as Vector
    },
    {
      // Couleur peu fréquente, claire (jaune)
      index: 2,
      frequency: 20,
      color: [255, 255, 0] as Vector,
      converted: [255, 255, 0] as Vector
    },
    {
      // Couleur très peu fréquente, sombre (bleu)
      index: 3,
      frequency: 10,
      color: [0, 0, 150] as Vector,
      converted: [0, 0, 150] as Vector
    },
    {
      // Couleur peu saturée (gris moyen)
      index: 4,
      frequency: 30,
      color: [128, 128, 128] as Vector,
      converted: [128, 128, 128] as Vector
    },
    {
      // Couleur très claire (blanc cassé)
      index: 5,
      frequency: 15,
      color: [240, 240, 240] as Vector,
      converted: [240, 240, 240] as Vector
    }
  ]

  describe('selectByFrequencyBalanced', () => {
    it('should select most frequent colors with diversity', () => {
      const candidates = createTestCandidates()
      const result = selectByFrequencyBalanced(candidates, 3)

      expect(result.selectedIndices).toHaveLength(3)
      expect(result.selectedIndices[0]).toBe(0) // Plus fréquent
      expect(result.selectedIndices).toContain(0) // Rouge (le plus fréquent)
    })

    it('should respect preselected indices', () => {
      const candidates = createTestCandidates()
      const result = selectByFrequencyBalanced(candidates, 3, [5])

      expect(result.selectedIndices).toHaveLength(3)
      expect(result.selectedIndices[0]).toBe(5) // Présélectionné en premier
    })

    it('should handle target colors larger than candidates', () => {
      const candidates = createTestCandidates().slice(0, 2)
      const result = selectByFrequencyBalanced(candidates, 5)

      expect(result.selectedIndices).toHaveLength(2)
    })
  })

  describe('selectByFrequencyMax', () => {
    it('should prioritize diversity over frequency compared to balanced', () => {
      const candidates = createTestCandidates()
      const resultBalanced = selectByFrequencyBalanced(candidates, 4)
      const resultMax = selectByFrequencyMax(candidates, 4)

      // Les deux devraient avoir 4 couleurs
      expect(resultBalanced.selectedIndices).toHaveLength(4)
      expect(resultMax.selectedIndices).toHaveLength(4)

      // Max devrait avoir des couleurs plus diverses (distance min plus grande)
      // Difficile à tester directement, mais on vérifie au moins qu'on a 4 couleurs
    })
  })

  describe('selectByBalancedScoreBalanced', () => {
    it('should balance frequency, diversity, and luminance', () => {
      const candidates = createTestCandidates()
      const result = selectByBalancedScoreBalanced(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      expect(result.scores).toBeDefined()
      // Le scores map peut avoir moins d'entrées si certaines couleurs sont filtrées
      expect(result.scores?.size).toBeGreaterThan(0)
      expect(result.scores?.size).toBeLessThanOrEqual(4)
    })

    it('should prioritize frequency in balanced mode', () => {
      const candidates = createTestCandidates()
      const result = selectByBalancedScoreBalanced(candidates, 3)

      // Devrait inclure la couleur la plus fréquente
      expect(result.selectedIndices).toContain(0)
    })
  })

  describe('selectByBalancedScoreMax', () => {
    it('should prioritize contrast over frequency', () => {
      const candidates = createTestCandidates()
      const result = selectByBalancedScoreMax(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      expect(result.scores).toBeDefined()
    })
  })

  describe('selectByPerceptualBalanced', () => {
    it('should distribute colors across luminance bins', () => {
      const candidates = createTestCandidates()
      const result = selectByPerceptualBalanced(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      // Devrait avoir des couleurs de différentes luminances
    })
  })

  describe('selectByPerceptualMax', () => {
    it('should prioritize diverse colors in each luminance bin', () => {
      const candidates = createTestCandidates()
      const result = selectByPerceptualMax(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
    })
  })

  describe('selectByDiversityFirstBalanced', () => {
    it('should maximize diversity with slight frequency weight', () => {
      const candidates = createTestCandidates()
      const result = selectByDiversityFirstBalanced(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      expect(result.scores).toBeDefined()
    })

    it('should adapt thresholds for CPC Classic (≤27 colors)', () => {
      const smallCandidates = createTestCandidates().slice(0, 4)
      const result = selectByDiversityFirstBalanced(smallCandidates, 3)

      expect(result.selectedIndices).toHaveLength(3)
    })

    it('should use strict thresholds for CPC Plus (>27 colors)', () => {
      const candidates = createTestCandidates()
      const result = selectByDiversityFirstBalanced(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
    })
  })

  describe('selectByDiversityFirstMax', () => {
    it('should ignore frequency completely', () => {
      const candidates = createTestCandidates()
      const result = selectByDiversityFirstMax(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      // Ne devrait pas nécessairement inclure la couleur la plus fréquente
    })

    it('should always return target number of colors', () => {
      const candidates = createTestCandidates()
      const result = selectByDiversityFirstMax(candidates, 3)

      // Devrait toujours trouver 3 couleurs grâce au fallback progressif
      expect(result.selectedIndices).toHaveLength(3)
    })

    it('should favor saturated colors on CPC Plus', () => {
      const candidates = [
        {
          // Couleur saturée (rouge pur)
          index: 0,
          frequency: 50,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          // Couleur peu saturée (gris)
          index: 1,
          frequency: 50,
          color: [128, 128, 128] as Vector,
          converted: [128, 128, 128] as Vector
        },
        {
          // Couleur moyennement saturée (vert pâle)
          index: 2,
          frequency: 50,
          color: [100, 200, 100] as Vector,
          converted: [100, 200, 100] as Vector
        }
      ]

      const result = selectByDiversityFirstMax(candidates, 2)

      // Devrait préférer les couleurs saturées pour CPC Plus
      expect(result.selectedIndices).toHaveLength(2)
    })
  })

  describe('selectByAdaptive', () => {
    it('should fallback to balanced-score-balanced', () => {
      const candidates = createTestCandidates()
      const resultAdaptive = selectByAdaptive(candidates, 4)
      const resultBalanced = selectByBalancedScoreBalanced(candidates, 4)

      // Devrait avoir le même nombre de couleurs
      expect(resultAdaptive.selectedIndices).toHaveLength(4)
      expect(resultBalanced.selectedIndices).toHaveLength(4)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty candidates', () => {
      const result = selectByFrequencyBalanced([], 4)
      expect(result.selectedIndices).toHaveLength(0)
    })

    it('should handle target colors of 0', () => {
      const candidates = createTestCandidates()
      const result = selectByFrequencyBalanced(candidates, 0, [0])
      expect(result.selectedIndices).toHaveLength(0)
    })

    it('should handle all preselected slots filled', () => {
      const candidates = createTestCandidates()
      const result = selectByFrequencyBalanced(candidates, 2, [0, 1])
      expect(result.selectedIndices).toEqual([0, 1])
    })

    it('should handle candidates with same frequency', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 50,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 50,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 50,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByFrequencyBalanced(candidates, 2)
      expect(result.selectedIndices).toHaveLength(2)
    })

    it('should handle preselected indices at target for BalancedScore', () => {
      const candidates = createTestCandidates()
      const result = selectByBalancedScoreBalanced(candidates, 3, [0, 1, 2])

      expect(result.selectedIndices).toHaveLength(3)
      expect(result.selectedIndices).toEqual([0, 1, 2])
    })

    it('should handle preselected indices exceeding target for BalancedScore', () => {
      const candidates = createTestCandidates()
      const result = selectByBalancedScoreMax(candidates, 2, [0, 1, 2, 3])

      // Devrait tronquer à targetColors
      expect(result.selectedIndices).toHaveLength(2)
      expect(result.selectedIndices).toEqual([0, 1])
    })

    it('should break when no more diverse colors in frequency strategy', () => {
      // Créer des couleurs très proches
      const closeCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [100, 100, 100] as Vector,
          converted: [100, 100, 100] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [101, 101, 101] as Vector,
          converted: [101, 101, 101] as Vector
        },
        {
          index: 2,
          frequency: 80,
          color: [102, 102, 102] as Vector,
          converted: [102, 102, 102] as Vector
        }
      ]

      const result = selectByFrequencyMax(closeCandidates, 3)

      // Devrait quand même utiliser fillRemainingSlots pour compléter
      expect(result.selectedIndices).toHaveLength(3)
    })
  })

  describe('Fallback mechanism in diversity-first', () => {
    it('should relax constraints progressively when needed', () => {
      // Créer des candidats très similaires (peu de diversité)
      const similarCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [100, 100, 100] as Vector,
          converted: [100, 100, 100] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [105, 105, 105] as Vector,
          converted: [105, 105, 105] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [110, 110, 110] as Vector,
          converted: [110, 110, 110] as Vector
        },
        {
          index: 3,
          frequency: 40,
          color: [115, 115, 115] as Vector,
          converted: [115, 115, 115] as Vector
        }
      ]

      const result = selectByDiversityFirstMax(similarCandidates, 4)

      // Devrait quand même trouver 4 couleurs grâce au fallback
      expect(result.selectedIndices).toHaveLength(4)
    })

    it('should use fallback when no candidate meets strict criteria', () => {
      // Créer des candidats avec des couleurs extrêmement similaires
      const extremelySimilarCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 50,
          color: [128, 128, 128] as Vector,
          converted: [128, 128, 128] as Vector
        },
        {
          index: 1,
          frequency: 50,
          color: [129, 129, 129] as Vector,
          converted: [129, 129, 129] as Vector
        },
        {
          index: 2,
          frequency: 50,
          color: [130, 130, 130] as Vector,
          converted: [130, 130, 130] as Vector
        }
      ]

      const result = selectByDiversityFirstMax(extremelySimilarCandidates, 3)

      // Devrait utiliser le fallback et trouver 3 couleurs
      expect(result.selectedIndices).toHaveLength(3)
    })

    it('should break when no fallback candidate is found', () => {
      // Cas extrême : un seul candidat demandé avec plusieurs disponibles
      const candidates = createTestCandidates()
      const result = selectByDiversityFirstMax(candidates, 1)

      expect(result.selectedIndices).toHaveLength(1)
    })
  })

  describe('selectByAdaptive - edge cases', () => {
    it('should use frequency-balanced when one color dominates strongly', () => {
      const dominantCandidates: ColorCandidate[] = [
        {
          // Couleur ultra-dominante (variance > 3)
          index: 0,
          frequency: 1000,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 100,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 100,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByAdaptive(dominantCandidates, 3)

      // Devrait utiliser frequency-balanced
      expect(result.selectedIndices).toHaveLength(3)
      // Devrait contenir la couleur dominante
      expect(result.selectedIndices).toContain(0)
    })

    it('should use balanced-score-balanced for even distribution', () => {
      const evenCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 95,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 90,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByAdaptive(evenCandidates, 3)

      // Devrait utiliser balanced-score-balanced (variance < 3)
      expect(result.selectedIndices).toHaveLength(3)
    })
  })

  describe('selectByBalancedScoreCore - fallback cases', () => {
    it('should use fallback when no candidate has good score', () => {
      // Créer une situation où le meilleur candidat ne peut pas être trouvé
      const edgeCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [0, 0, 0] as Vector,
          converted: [0, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 50,
          color: [1, 1, 1] as Vector,
          converted: [1, 1, 1] as Vector
        }
      ]

      const result = selectByBalancedScoreBalanced(edgeCandidates, 2)

      // Devrait quand même retourner 2 couleurs
      expect(result.selectedIndices).toHaveLength(2)
    })
  })

  describe('CPC Plus vs CPC Classic threshold differences', () => {
    it('should use relaxed thresholds for CPC Classic (≤27 colors)', () => {
      const cpcClassicCandidates: ColorCandidate[] = Array.from(
        { length: 27 },
        (_, i) => ({
          index: i,
          frequency: 100 - i,
          color: [i * 10, i * 10, i * 10] as Vector,
          converted: [i * 10, i * 10, i * 10] as Vector
        })
      )

      const result = selectByDiversityFirstMax(cpcClassicCandidates, 10)

      // Devrait réussir à trouver 10 couleurs avec les seuils relaxés
      expect(result.selectedIndices).toHaveLength(10)
    })

    it('should use strict thresholds for CPC Plus (>27 colors)', () => {
      const cpcPlusCandidates: ColorCandidate[] = Array.from(
        { length: 50 },
        (_, i) => ({
          index: i,
          frequency: 100 - i,
          color: [i * 5, i * 5, i * 5] as Vector,
          converted: [i * 5, i * 5, i * 5] as Vector
        })
      )

      const result = selectByDiversityFirstMax(cpcPlusCandidates, 10)

      // Devrait réussir à trouver 10 couleurs avec les seuils stricts
      expect(result.selectedIndices).toHaveLength(10)
    })
  })

  describe('Perceptual strategies with empty bins', () => {
    it('should handle luminance bins with no candidates', () => {
      // Créer des candidats tous dans la même plage de luminance
      const sameLuminanceCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [100, 100, 100] as Vector,
          converted: [100, 100, 100] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [105, 105, 105] as Vector,
          converted: [105, 105, 105] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [110, 110, 110] as Vector,
          converted: [110, 110, 110] as Vector
        }
      ]

      const result = selectByPerceptualBalanced(sameLuminanceCandidates, 4)

      // Devrait compléter avec fillRemainingSlots
      expect(result.selectedIndices).toHaveLength(3)
    })

    it('should handle perceptualMax with preselected indices at target', () => {
      const candidates = createTestCandidates()
      const result = selectByPerceptualMax(candidates, 2, [0, 1])

      // Devrait retourner exactement les indices présélectionnés
      expect(result.selectedIndices).toEqual([0, 1])
    })
  })

  describe('BalancedScore fallback mechanism', () => {
    it('should trigger fallback when no best candidate found', () => {
      // Créer une situation où aucun candidat ne peut être trouvé
      const difficultCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [0, 0, 0] as Vector,
          converted: [0, 0, 0] as Vector
        }
      ]

      const result = selectByBalancedScoreBalanced(difficultCandidates, 2)

      // Devrait utiliser le fallback et retourner au moins 1 couleur
      expect(result.selectedIndices.length).toBeGreaterThan(0)
      expect(result.selectedIndices.length).toBeLessThanOrEqual(2)
    })

    it('should break loop when no fallback available', () => {
      const singleCandidate: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [128, 128, 128] as Vector,
          converted: [128, 128, 128] as Vector
        }
      ]

      const result = selectByBalancedScoreMax(singleCandidate, 5)

      // Devrait s'arrêter après avoir épuisé les candidats
      expect(result.selectedIndices).toHaveLength(1)
    })
  })

  describe('DiversityFirst ultimate fallback', () => {
    it('should use most diverse without constraints when all else fails', () => {
      // Créer des candidats identiques pour forcer le dernier fallback
      const identicalCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 50,
          color: [100, 100, 100] as Vector,
          converted: [100, 100, 100] as Vector
        },
        {
          index: 1,
          frequency: 50,
          color: [100, 100, 100] as Vector,
          converted: [100, 100, 100] as Vector
        },
        {
          index: 2,
          frequency: 50,
          color: [101, 101, 101] as Vector,
          converted: [101, 101, 101] as Vector
        }
      ]

      const result = selectByDiversityFirstMax(identicalCandidates, 3)

      // Devrait quand même trouver 3 couleurs via le dernier recours
      expect(result.selectedIndices).toHaveLength(3)
    })

    it('should break when no diverse candidate can be found', () => {
      const singleCandidate: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [128, 128, 128] as Vector,
          converted: [128, 128, 128] as Vector
        }
      ]

      const result = selectByDiversityFirstBalanced(singleCandidate, 5)

      // Devrait s'arrêter avec un seul candidat
      expect(result.selectedIndices).toHaveLength(1)
    })
  })

  // ============================================================================
  // EXHAUSTIVE CONTRAST STRATEGY TESTS
  // ============================================================================

  describe('selectByExhaustiveContrast', () => {
    it('should return correct number of colors', () => {
      const candidates = createTestCandidates()
      const result = selectByExhaustiveContrast(candidates, 4)
      expect(result.selectedIndices).toHaveLength(4)
    })

    it('should maximize contrast by testing all combinations', () => {
      // Candidats avec couleurs très contrastées
      const contrastCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [0, 0, 0] as Vector, // Noir
          converted: [0, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [255, 255, 255] as Vector, // Blanc
          converted: [255, 255, 255] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [10, 10, 10] as Vector, // Quasi-noir
          converted: [10, 10, 10] as Vector
        },
        {
          index: 3,
          frequency: 40,
          color: [255, 0, 0] as Vector, // Rouge vif
          converted: [255, 0, 0] as Vector
        },
        {
          index: 4,
          frequency: 20,
          color: [0, 255, 0] as Vector, // Vert vif
          converted: [0, 255, 0] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(contrastCandidates, 3)

      // Devrait préférer noir, blanc et une couleur saturée (pas quasi-noir)
      expect(result.selectedIndices).toHaveLength(3)
      // Le quasi-noir (index 2) ne devrait PAS être sélectionné car trop proche du noir
      expect(result.selectedIndices).not.toContain(2)
    })

    it('should respect preselected indices', () => {
      const candidates = createTestCandidates()
      const preselected = [0, 1]

      const result = selectByExhaustiveContrast(candidates, 4, preselected)

      expect(result.selectedIndices).toHaveLength(4)
      expect(result.selectedIndices).toContain(0)
      expect(result.selectedIndices).toContain(1)
    })

    it('should handle edge case with fewer candidates than needed', () => {
      const fewCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [0, 0, 0] as Vector,
          converted: [0, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 50,
          color: [255, 255, 255] as Vector,
          converted: [255, 255, 255] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(fewCandidates, 4)

      // Devrait retourner tous les candidats disponibles
      expect(result.selectedIndices).toHaveLength(2)
    })

    it('should prefer combinations with dark AND bright colors', () => {
      // Candidats sans couleur sombre
      const noDarkCandidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [200, 200, 200] as Vector, // Gris clair
          converted: [200, 200, 200] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [255, 255, 255] as Vector, // Blanc
          converted: [255, 255, 255] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 0] as Vector, // Noir - seule couleur sombre
          converted: [0, 0, 0] as Vector
        },
        {
          index: 3,
          frequency: 40,
          color: [255, 200, 200] as Vector, // Rose clair
          converted: [255, 200, 200] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(noDarkCandidates, 2)

      // Devrait inclure le noir (seule couleur sombre) pour le contraste
      expect(result.selectedIndices).toContain(2)
    })

    it('should handle pre-filtering with many candidates (> 12)', () => {
      // Créer 20 candidats pour tester le pre-filtering
      const manyCandidates: ColorCandidate[] = []
      for (let i = 0; i < 20; i++) {
        const brightness = (i * 12) % 256 // Variations de luminosité
        manyCandidates.push({
          index: i,
          frequency: 100 - i * 4, // Fréquences décroissantes
          color: [brightness, brightness, brightness] as Vector,
          converted: [brightness, brightness, brightness] as Vector
        })
      }

      // Ne doit pas planter malgré les nombreux candidats
      const result = selectByExhaustiveContrast(manyCandidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      // Les indices sélectionnés doivent être valides
      for (const idx of result.selectedIndices) {
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(20)
      }
    })

    it('should include diverse luminance even with many candidates', () => {
      // Créer candidats avec un mélange de luminances
      const diverseCandidates: ColorCandidate[] = [
        // Couleurs sombres
        {
          index: 0,
          frequency: 90,
          color: [20, 20, 20] as Vector,
          converted: [20, 20, 20] as Vector
        },
        {
          index: 1,
          frequency: 85,
          color: [40, 40, 40] as Vector,
          converted: [40, 40, 40] as Vector
        },
        // Couleurs moyennes
        {
          index: 2,
          frequency: 80,
          color: [128, 128, 128] as Vector,
          converted: [128, 128, 128] as Vector
        },
        {
          index: 3,
          frequency: 75,
          color: [140, 140, 140] as Vector,
          converted: [140, 140, 140] as Vector
        },
        // Couleurs claires
        {
          index: 4,
          frequency: 70,
          color: [220, 220, 220] as Vector,
          converted: [220, 220, 220] as Vector
        },
        {
          index: 5,
          frequency: 65,
          color: [240, 240, 240] as Vector,
          converted: [240, 240, 240] as Vector
        },
        // Plus de candidats pour dépasser le seuil
        {
          index: 6,
          frequency: 60,
          color: [60, 60, 60] as Vector,
          converted: [60, 60, 60] as Vector
        },
        {
          index: 7,
          frequency: 55,
          color: [80, 80, 80] as Vector,
          converted: [80, 80, 80] as Vector
        },
        {
          index: 8,
          frequency: 50,
          color: [100, 100, 100] as Vector,
          converted: [100, 100, 100] as Vector
        },
        {
          index: 9,
          frequency: 45,
          color: [160, 160, 160] as Vector,
          converted: [160, 160, 160] as Vector
        },
        {
          index: 10,
          frequency: 40,
          color: [180, 180, 180] as Vector,
          converted: [180, 180, 180] as Vector
        },
        {
          index: 11,
          frequency: 35,
          color: [200, 200, 200] as Vector,
          converted: [200, 200, 200] as Vector
        },
        {
          index: 12,
          frequency: 30,
          color: [30, 30, 30] as Vector,
          converted: [30, 30, 30] as Vector
        },
        {
          index: 13,
          frequency: 25,
          color: [250, 250, 250] as Vector,
          converted: [250, 250, 250] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(diverseCandidates, 4)

      expect(result.selectedIndices).toHaveLength(4)

      // Vérifier qu'on a du contraste dans le résultat
      const selectedColors = result.selectedIndices.map(
        (idx) => diverseCandidates.find((c) => c.index === idx)!.color
      )
      const luminances = selectedColors.map((c) => (c[0] + c[1] + c[2]) / 3)
      const minLum = Math.min(...luminances)
      const maxLum = Math.max(...luminances)

      // Il devrait y avoir un écart de luminance significatif
      expect(maxLum - minLum).toBeGreaterThan(100)
    })
  })

  describe('applyPaletteStrategyV2', () => {
    const createTestCandidates = (): ColorCandidate[] => [
      {
        index: 0,
        frequency: 100,
        color: [0, 0, 0] as Vector,
        converted: [0, 0, 0] as Vector
      },
      {
        index: 1,
        frequency: 80,
        color: [255, 255, 255] as Vector,
        converted: [255, 255, 255] as Vector
      },
      {
        index: 2,
        frequency: 60,
        color: [255, 0, 0] as Vector,
        converted: [255, 0, 0] as Vector
      },
      {
        index: 3,
        frequency: 40,
        color: [0, 255, 0] as Vector,
        converted: [0, 255, 0] as Vector
      },
      {
        index: 4,
        frequency: 20,
        color: [0, 0, 255] as Vector,
        converted: [0, 0, 255] as Vector
      }
    ]

    it('should apply exhaustive-contrast strategy', () => {
      const candidates = createTestCandidates()
      const result = applyPaletteStrategyV2(
        'exhaustive-contrast',
        candidates,
        4
      )

      expect(result.selectedIndices).toHaveLength(4)
    })

    it('should apply frequency-balanced strategy', () => {
      const candidates = createTestCandidates()
      const result = applyPaletteStrategyV2('frequency-balanced', candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      expect(result.selectedIndices).toContain(0) // Most frequent
    })

    it('should apply all strategies without error', () => {
      const candidates = createTestCandidates()

      for (const strategy of AVAILABLE_STRATEGIES) {
        const result = applyPaletteStrategyV2(strategy, candidates, 3)
        expect(result.selectedIndices.length).toBeGreaterThan(0)
        expect(result.selectedIndices.length).toBeLessThanOrEqual(3)
      }
    })

    it('should handle preselected indices', () => {
      const candidates = createTestCandidates()
      const preselected = [4] // Blue

      const result = applyPaletteStrategyV2(
        'frequency-balanced',
        candidates,
        3,
        preselected
      )

      expect(result.selectedIndices).toContain(4)
    })

    it('should fallback to frequency-balanced for unknown strategy', () => {
      const candidates = createTestCandidates()
      // @ts-expect-error - Testing invalid strategy
      const result = applyPaletteStrategyV2('unknown-strategy', candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
    })
  })

  describe('isValidPaletteStrategy', () => {
    it('should return true for valid strategies', () => {
      expect(isValidPaletteStrategy('exhaustive-contrast')).toBe(true)
      expect(isValidPaletteStrategy('frequency-balanced')).toBe(true)
      expect(isValidPaletteStrategy('adaptive')).toBe(true)
    })

    it('should return false for invalid strategies', () => {
      expect(isValidPaletteStrategy('invalid')).toBe(false)
      expect(isValidPaletteStrategy('')).toBe(false)
      expect(isValidPaletteStrategy('random')).toBe(false)
    })
  })

  describe('AVAILABLE_STRATEGIES', () => {
    it('should contain all 13 strategies', () => {
      expect(AVAILABLE_STRATEGIES).toHaveLength(13)
    })

    it('should contain exhaustive-contrast', () => {
      expect(AVAILABLE_STRATEGIES).toContain('exhaustive-contrast')
    })

    it('should contain all strategy names', () => {
      const expectedStrategies: PaletteStrategyName[] = [
        'exhaustive-contrast',
        'coverage-aware',
        'dithering-aware',
        'frequency-balanced',
        'frequency-max',
        'balanced-score-balanced',
        'balanced-score-max',
        'perceptual-balanced',
        'perceptual-max',
        'diversity-first-balanced',
        'diversity-first-max',
        'adaptive',
        'mode0-hue-diversity'
      ]

      for (const strategy of expectedStrategies) {
        expect(AVAILABLE_STRATEGIES).toContain(strategy)
      }
    })
  })

  describe('selectByCoverageAware', () => {
    it('should select colors that maximize coverage', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        },
        {
          index: 3,
          frequency: 40,
          color: [255, 255, 0] as Vector,
          converted: [255, 255, 0] as Vector
        }
      ]

      const result = selectByCoverageAware(candidates, 3)

      expect(result.selectedIndices).toHaveLength(3)
      expect(result.selectedIndices).toContain(0) // Most frequent
    })

    it('should handle preselected indices', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByCoverageAware(candidates, 2, [1])

      expect(result.selectedIndices).toHaveLength(2)
      expect(result.selectedIndices[0]).toBe(1) // Preselected first
    })

    it('should return early when preselected fills target', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }
      ]

      const result = selectByCoverageAware(candidates, 2, [0, 1])

      expect(result.selectedIndices).toHaveLength(2)
      expect(result.selectedIndices).toEqual([0, 1])
    })

    it('should handle fewer candidates than needed', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }
      ]

      const result = selectByCoverageAware(candidates, 3)

      expect(result.selectedIndices.length).toBeLessThanOrEqual(3)
    })
  })

  describe('selectByDitheringAware', () => {
    it('should select colors optimized for dithering', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        },
        {
          index: 3,
          frequency: 40,
          color: [128, 128, 128] as Vector,
          converted: [128, 128, 128] as Vector
        }
      ]

      const result = selectByDitheringAware(candidates, 3)

      expect(result.selectedIndices).toHaveLength(3)
    })

    it('should handle preselected indices', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        }
      ]

      const result = selectByDitheringAware(candidates, 2, [1])

      expect(result.selectedIndices).toHaveLength(2)
      expect(result.selectedIndices[0]).toBe(1)
    })

    it('should return early when preselected fills target', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }
      ]

      const result = selectByDitheringAware(candidates, 2, [0, 1])

      expect(result.selectedIndices).toHaveLength(2)
    })

    it('should handle fewer candidates than needed', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }
      ]

      const result = selectByDitheringAware(candidates, 3)

      expect(result.selectedIndices.length).toBeLessThanOrEqual(3)
    })

    it('should apply through applyPaletteStrategyV2', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        }
      ]

      const result = applyPaletteStrategyV2('dithering-aware', candidates, 2)

      expect(result.selectedIndices).toHaveLength(2)
    })

    it('should work with CPC Classic palette size', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByDitheringAware(candidates, 2, [], {
        basePaletteSize: 27
      })

      expect(result.selectedIndices).toHaveLength(2)
    })

    it('should work with CPC Plus palette size', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByDitheringAware(candidates, 2, [], {
        basePaletteSize: 4096
      })

      expect(result.selectedIndices).toHaveLength(2)
    })

    it('should filter candidates with hue diversity when too many', () => {
      // Create many candidates to trigger filtering
      const candidates: ColorCandidate[] = Array.from(
        { length: 20 },
        (_, i) => ({
          index: i,
          frequency: 100 - i * 5,
          color: [(i * 13) % 256, (i * 17) % 256, (i * 19) % 256] as Vector,
          converted: [(i * 13) % 256, (i * 17) % 256, (i * 19) % 256] as Vector
        })
      )

      const result = selectByDitheringAware(candidates, 4, [], {
        basePaletteSize: 4096
      })

      expect(result.selectedIndices).toHaveLength(4)
    })
  })

  describe('selectByExhaustiveContrast - CPC Plus enhancements', () => {
    it('should include a dark color in the palette', () => {
      const candidates: ColorCandidate[] = [
        // Couleurs claires/moyennes seulement
        {
          index: 0,
          frequency: 100,
          color: [255, 200, 100] as Vector,
          converted: [255, 200, 100] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [100, 255, 200] as Vector,
          converted: [100, 255, 200] as Vector
        },
        {
          index: 2,
          frequency: 80,
          color: [200, 100, 255] as Vector,
          converted: [200, 100, 255] as Vector
        },
        // Une couleur sombre
        {
          index: 3,
          frequency: 10,
          color: [10, 10, 10] as Vector,
          converted: [10, 10, 10] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(candidates, 4)

      // Devrait inclure la couleur sombre malgré sa faible fréquence
      expect(result.selectedIndices).toContain(3)
    })

    it('should avoid selecting colors too similar in hue for CPC Plus', () => {
      // Deux jaunes très similaires
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [0, 0, 0] as Vector, // noir
          converted: [0, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [221, 170, 0] as Vector, // jaune 1
          converted: [221, 170, 0] as Vector
        },
        {
          index: 2,
          frequency: 80,
          color: [204, 170, 0] as Vector, // jaune 2 (très similaire)
          converted: [204, 170, 0] as Vector
        },
        {
          index: 3,
          frequency: 70,
          color: [0, 100, 200] as Vector, // bleu
          converted: [0, 100, 200] as Vector
        },
        {
          index: 4,
          frequency: 60,
          color: [200, 50, 100] as Vector, // rose/magenta
          converted: [200, 50, 100] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(candidates, 4)

      // Ne devrait PAS sélectionner les deux jaunes similaires
      const hasYellow1 = result.selectedIndices.includes(1)
      const hasYellow2 = result.selectedIndices.includes(2)
      expect(hasYellow1 && hasYellow2).toBe(false)
    })

    it('should prefer saturated colors for CPC Plus', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [0, 0, 0] as Vector, // noir
          converted: [0, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [255, 0, 0] as Vector, // rouge saturé
          converted: [255, 0, 0] as Vector
        },
        {
          index: 2,
          frequency: 85,
          color: [180, 100, 100] as Vector, // rouge désaturé
          converted: [180, 100, 100] as Vector
        },
        {
          index: 3,
          frequency: 80,
          color: [0, 255, 0] as Vector, // vert saturé
          converted: [0, 255, 0] as Vector
        },
        {
          index: 4,
          frequency: 75,
          color: [100, 180, 100] as Vector, // vert désaturé
          converted: [100, 180, 100] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(candidates, 3)

      // Devrait préférer les couleurs saturées
      expect(result.selectedIndices).toContain(1) // rouge saturé
      // Le vert saturé ou une combinaison diverse
    })

    it('should respect preselected colors and avoid similar hues', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector, // rouge
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [250, 50, 50] as Vector, // rouge similaire
          converted: [250, 50, 50] as Vector
        },
        {
          index: 2,
          frequency: 80,
          color: [0, 255, 0] as Vector, // vert
          converted: [0, 255, 0] as Vector
        },
        {
          index: 3,
          frequency: 70,
          color: [0, 0, 255] as Vector, // bleu
          converted: [0, 0, 255] as Vector
        }
      ]

      // Rouge présélectionné (locké)
      const result = selectByExhaustiveContrast(candidates, 3, [0])

      expect(result.selectedIndices).toContain(0) // présélectionné
      // Ne devrait pas sélectionner le rouge similaire (index 1)
      expect(result.selectedIndices).not.toContain(1)
    })
  })

  describe('Hue diversity calculations', () => {
    it('should correctly identify colors with diverse hues', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector, // rouge (~0°)
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [0, 255, 0] as Vector, // vert (~120°)
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 80,
          color: [0, 0, 255] as Vector, // bleu (~240°)
          converted: [0, 0, 255] as Vector
        },
        {
          index: 3,
          frequency: 70,
          color: [0, 0, 0] as Vector, // noir
          converted: [0, 0, 0] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(candidates, 4)

      // Toutes les couleurs devraient être sélectionnées car elles ont des teintes très différentes
      expect(result.selectedIndices).toHaveLength(4)
    })

    it('should handle achromatic colors (grays) correctly', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [128, 128, 128] as Vector, // gris moyen
          converted: [128, 128, 128] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [64, 64, 64] as Vector, // gris sombre
          converted: [64, 64, 64] as Vector
        },
        {
          index: 2,
          frequency: 80,
          color: [192, 192, 192] as Vector, // gris clair
          converted: [192, 192, 192] as Vector
        },
        {
          index: 3,
          frequency: 70,
          color: [255, 0, 0] as Vector, // rouge (seule couleur saturée)
          converted: [255, 0, 0] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(candidates, 3)

      // Devrait inclure le rouge car c'est la seule couleur saturée
      expect(result.selectedIndices).toContain(3)
    })
  })

  describe('Dark color forcing', () => {
    it('should force a dark color when none is present', () => {
      // Toutes les couleurs sont claires sauf une
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 255, 200] as Vector, // jaune clair
          converted: [255, 255, 200] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [200, 255, 255] as Vector, // cyan clair
          converted: [200, 255, 255] as Vector
        },
        {
          index: 2,
          frequency: 80,
          color: [255, 200, 255] as Vector, // magenta clair
          converted: [255, 200, 255] as Vector
        },
        {
          index: 3,
          frequency: 10, // Faible fréquence mais sombre
          color: [20, 20, 20] as Vector,
          converted: [20, 20, 20] as Vector
        }
      ]

      const result = selectByExhaustiveContrast(candidates, 4)

      // Devrait inclure la couleur sombre malgré sa faible fréquence
      expect(result.selectedIndices).toContain(3)
    })

    it('should not force dark color if already preselected', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [10, 10, 10] as Vector, // noir (présélectionné)
          converted: [10, 10, 10] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 2,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 3,
          frequency: 70,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        },
        {
          index: 4,
          frequency: 5,
          color: [5, 5, 5] as Vector, // autre noir
          converted: [5, 5, 5] as Vector
        }
      ]

      // Noir présélectionné
      const result = selectByExhaustiveContrast(candidates, 4, [0])

      expect(result.selectedIndices).toContain(0)
      // Ne devrait pas avoir besoin d'ajouter un autre noir
      expect(result.selectedIndices).not.toContain(4)
    })
  })

  describe('selectByMode0HueDiversity', () => {
    it('should select colors from different hue buckets', () => {
      const candidates: ColorCandidate[] = [
        // Red hue bucket (0-45°)
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        // Yellow hue bucket (45-90°)
        {
          index: 1,
          frequency: 80,
          color: [255, 255, 0] as Vector,
          converted: [255, 255, 0] as Vector
        },
        // Green hue bucket (90-135°)
        {
          index: 2,
          frequency: 60,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        // Cyan hue bucket (135-180°)
        {
          index: 3,
          frequency: 40,
          color: [0, 255, 255] as Vector,
          converted: [0, 255, 255] as Vector
        },
        // Blue hue bucket (180-225°)
        {
          index: 4,
          frequency: 30,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByMode0HueDiversity(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      // Should select from different hue families
      expect(result.selectedIndices).toContain(0) // Red (most frequent)
    })

    it('should handle gray/desaturated colors', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [128, 128, 128] as Vector, // Gray
          converted: [128, 128, 128] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [64, 64, 64] as Vector, // Dark gray
          converted: [64, 64, 64] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [192, 192, 192] as Vector, // Light gray
          converted: [192, 192, 192] as Vector
        },
        {
          index: 3,
          frequency: 40,
          color: [255, 0, 0] as Vector, // Red (saturated)
          converted: [255, 0, 0] as Vector
        }
      ]

      const result = selectByMode0HueDiversity(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
      // Should include both grays and saturated colors
      expect(result.selectedIndices).toContain(3) // Red
    })

    it('should respect preselected indices', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByMode0HueDiversity(candidates, 3, [1])

      expect(result.selectedIndices).toHaveLength(3)
      expect(result.selectedIndices[0]).toBe(1) // Preselected first
    })

    it('should return early when preselected fills target', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }
      ]

      const result = selectByMode0HueDiversity(candidates, 2, [0, 1])

      expect(result.selectedIndices).toHaveLength(2)
      expect(result.selectedIndices).toEqual([0, 1])
    })

    it('should use MaxMin distance when not enough diverse colors', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [250, 5, 5] as Vector, // Very similar to red
          converted: [250, 5, 5] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 255] as Vector, // Blue (different)
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = selectByMode0HueDiversity(candidates, 3)

      expect(result.selectedIndices).toHaveLength(3)
      // Should include blue for diversity
      expect(result.selectedIndices).toContain(2)
    })

    it('should handle empty candidates', () => {
      const result = selectByMode0HueDiversity([], 4)
      expect(result.selectedIndices).toHaveLength(0)
    })

    it('should work with many hue buckets', () => {
      // Create colors spanning all 8 hue buckets
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }, // Red
        {
          index: 1,
          frequency: 90,
          color: [255, 128, 0] as Vector,
          converted: [255, 128, 0] as Vector
        }, // Orange
        {
          index: 2,
          frequency: 80,
          color: [255, 255, 0] as Vector,
          converted: [255, 255, 0] as Vector
        }, // Yellow
        {
          index: 3,
          frequency: 70,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        }, // Green
        {
          index: 4,
          frequency: 60,
          color: [0, 255, 255] as Vector,
          converted: [0, 255, 255] as Vector
        }, // Cyan
        {
          index: 5,
          frequency: 50,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }, // Blue
        {
          index: 6,
          frequency: 40,
          color: [128, 0, 255] as Vector,
          converted: [128, 0, 255] as Vector
        }, // Purple
        {
          index: 7,
          frequency: 30,
          color: [255, 0, 128] as Vector,
          converted: [255, 0, 128] as Vector
        } // Magenta
      ]

      const result = selectByMode0HueDiversity(candidates, 8)

      expect(result.selectedIndices).toHaveLength(8)
    })

    it('should apply through applyPaletteStrategyV2', () => {
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        },
        {
          index: 1,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        },
        {
          index: 2,
          frequency: 60,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        }
      ]

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        3
      )

      expect(result.selectedIndices).toHaveLength(3)
    })

    it('should filter similar saturated colors by hue distance', () => {
      // Two very similar red hues (both saturated)
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }, // Red
        {
          index: 1,
          frequency: 90,
          color: [255, 20, 0] as Vector,
          converted: [255, 20, 0] as Vector
        }, // Similar red
        {
          index: 2,
          frequency: 80,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        }, // Green (different)
        {
          index: 3,
          frequency: 70,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        } // Blue (different)
      ]

      const result = selectByMode0HueDiversity(candidates, 3)

      expect(result.selectedIndices).toHaveLength(3)
      // Should prefer diverse hues over similar ones
      expect(result.selectedIndices).toContain(0) // First red
      expect(result.selectedIndices).toContain(2) // Green
      expect(result.selectedIndices).toContain(3) // Blue
    })

    it('should check RGB distance when hues are close', () => {
      // Colors with similar hue but different RGB values
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }, // Bright red
        {
          index: 1,
          frequency: 90,
          color: [200, 0, 0] as Vector,
          converted: [200, 0, 0] as Vector
        }, // Darker red (similar hue)
        {
          index: 2,
          frequency: 80,
          color: [100, 0, 0] as Vector,
          converted: [100, 0, 0] as Vector
        }, // Even darker red
        {
          index: 3,
          frequency: 70,
          color: [0, 0, 255] as Vector,
          converted: [0, 0, 255] as Vector
        } // Blue (different)
      ]

      const result = selectByMode0HueDiversity(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
    })

    it('should use hue bonus in MaxMin distance selection', () => {
      // Test that saturated colors with different hues get bonus
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }, // Red (saturated)
        {
          index: 1,
          frequency: 50,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        }, // Green (saturated, different hue)
        {
          index: 2,
          frequency: 90,
          color: [255, 10, 10] as Vector,
          converted: [255, 10, 10] as Vector
        }, // Similar red
        {
          index: 3,
          frequency: 80,
          color: [128, 128, 128] as Vector,
          converted: [128, 128, 128] as Vector
        } // Gray (not saturated)
      ]

      const result = selectByMode0HueDiversity(candidates, 3)

      expect(result.selectedIndices).toHaveLength(3)
      // Should prefer the diverse green over similar red despite lower frequency
      expect(result.selectedIndices).toContain(1) // Green for diversity
    })

    it('should handle low saturation colors without hue check', () => {
      // Low saturation colors shouldn't trigger hue distance checks
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [130, 128, 128] as Vector,
          converted: [130, 128, 128] as Vector
        }, // Near gray
        {
          index: 1,
          frequency: 90,
          color: [128, 130, 128] as Vector,
          converted: [128, 130, 128] as Vector
        }, // Near gray
        {
          index: 2,
          frequency: 80,
          color: [128, 128, 130] as Vector,
          converted: [128, 128, 130] as Vector
        }, // Near gray
        {
          index: 3,
          frequency: 70,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        } // Red (saturated)
      ]

      const result = selectByMode0HueDiversity(candidates, 4)

      expect(result.selectedIndices).toHaveLength(4)
    })

    it('should reject colors too close in RGB distance', () => {
      // Colors that are very close in RGB even if hues are different
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [100, 100, 100] as Vector,
          converted: [100, 100, 100] as Vector
        },
        {
          index: 1,
          frequency: 90,
          color: [105, 100, 100] as Vector,
          converted: [105, 100, 100] as Vector
        }, // Very close
        {
          index: 2,
          frequency: 80,
          color: [100, 105, 100] as Vector,
          converted: [100, 105, 100] as Vector
        }, // Very close
        {
          index: 3,
          frequency: 70,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        } // Different
      ]

      const result = selectByMode0HueDiversity(candidates, 4)

      // Should reject similar colors and prefer the diverse one
      expect(result.selectedIndices).toContain(3) // Red is different
    })

    it('should handle saturated colors with close hue but different RGB', () => {
      // Both saturated, close hue, but different RGB distance
      const candidates: ColorCandidate[] = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0] as Vector,
          converted: [255, 0, 0] as Vector
        }, // Bright saturated red
        {
          index: 1,
          frequency: 90,
          color: [255, 30, 30] as Vector,
          converted: [255, 30, 30] as Vector
        }, // Similar hue, close RGB
        {
          index: 2,
          frequency: 80,
          color: [128, 0, 0] as Vector,
          converted: [128, 0, 0] as Vector
        }, // Similar hue, different RGB
        {
          index: 3,
          frequency: 70,
          color: [0, 255, 0] as Vector,
          converted: [0, 255, 0] as Vector
        } // Different hue
      ]

      const result = selectByMode0HueDiversity(candidates, 3)

      expect(result.selectedIndices).toHaveLength(3)
      expect(result.selectedIndices).toContain(0) // First red
      expect(result.selectedIndices).toContain(3) // Green for hue diversity
    })
  })
})
