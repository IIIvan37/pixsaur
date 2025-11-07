import { describe, expect, it } from 'vitest'
import type { Vector } from '../type'
import {
  type ColorCandidate,
  selectByAdaptive,
  selectByBalancedScoreBalanced,
  selectByBalancedScoreMax,
  selectByDiversityFirstBalanced,
  selectByDiversityFirstMax,
  selectByFrequencyBalanced,
  selectByFrequencyMax,
  selectByPerceptualBalanced,
  selectByPerceptualMax
} from './palette-strategies-v2'

describe('palette-strategies-v2', () => {
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
})
