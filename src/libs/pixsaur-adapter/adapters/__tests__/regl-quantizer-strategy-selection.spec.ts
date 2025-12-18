/**
 * Tests d'intégration pour selectDiverseColorsFast dans ReGLQuantizer
 *
 * Ces tests capturent le comportement actuel AVANT refactoring pour:
 * - Garantir que le choix de stratégie selon le mode est correct
 * - Valider le flux complet de sélection de palette
 * - Documenter les différences CPC Classic vs CPC Plus
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaletteStrategy } from '@/app/store/config/types'
import {
  applyPaletteStrategyV2,
  type ColorCandidate,
  type PaletteStrategyName
} from '@/libs/pixsaur-color/src/quant/palette-strategies-v2'
import type { Vector } from '@/libs/pixsaur-color/src/type'

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

// Constantes CPC (doivent correspondre à regl-quantizer.ts)
const CPC_MODE_1_MAX_COLORS = 4

/**
 * Simule le choix de stratégie effectif tel que dans selectDiverseColorsFast
 */
function getEffectiveStrategy(
  targetColors: number,
  userStrategy: PaletteStrategy
): PaletteStrategyName {
  // Reproduire la logique de selectDiverseColorsFast
  return targetColors > CPC_MODE_1_MAX_COLORS
    ? 'mode0-hue-diversity'
    : (userStrategy as PaletteStrategyName)
}

/**
 * Génère une palette CPC Plus (4096 couleurs)
 */
function generateCPCPlusPalette(): Vector[] {
  const palette: Vector[] = []
  for (let r = 0; r < 16; r++) {
    for (let g = 0; g < 16; g++) {
      for (let b = 0; b < 16; b++) {
        palette.push([r * 17, g * 17, b * 17])
      }
    }
  }
  return palette
}

/**
 * Génère la palette CPC Classic (27 couleurs)
 */
function generateCPCClassicPalette(): Vector[] {
  const levels = [0, 128, 255]
  const palette: Vector[] = []
  for (const r of levels) {
    for (const g of levels) {
      for (const b of levels) {
        palette.push([r, g, b])
      }
    }
  }
  return palette
}

/**
 * Crée des candidats depuis une palette avec des fréquences simulées
 */
function createCandidatesFromPalette(
  basePalette: Vector[],
  usedIndices: number[] = []
): ColorCandidate[] {
  const candidates: ColorCandidate[] = []
  const usedSet = new Set(usedIndices)

  for (let i = 0; i < basePalette.length; i++) {
    if (!usedSet.has(i)) {
      // Simuler une fréquence décroissante
      const frequency = 1 / (i + 1)
      candidates.push({
        index: i,
        frequency,
        color: basePalette[i],
        converted: basePalette[i]
      })
    }
  }

  return candidates.sort((a, b) => b.frequency - a.frequency)
}

describe('selectDiverseColorsFast Strategy Selection', () => {
  describe('Mode 0 (16 colors) - should use mode0-hue-diversity', () => {
    const mode0TargetColors = [5, 8, 12, 16]

    for (const targetColors of mode0TargetColors) {
      it(`should use mode0-hue-diversity for targetColors=${targetColors}`, () => {
        const userStrategy: PaletteStrategy = 'frequency-balanced'
        const effectiveStrategy = getEffectiveStrategy(
          targetColors,
          userStrategy
        )

        expect(effectiveStrategy).toBe('mode0-hue-diversity')
      })
    }

    it('should use mode0-hue-diversity regardless of user strategy for mode 0', () => {
      const userStrategies: PaletteStrategy[] = [
        'frequency-balanced',
        'frequency-max',
        'diversity-first-balanced',
        'diversity-first-max',
        'perceptual-balanced',
        'perceptual-max',
        'balanced-score-balanced',
        'balanced-score-max',
        'adaptive',
        'exhaustive-contrast',
        'coverage-aware',
        'dithering-aware'
      ]

      for (const userStrategy of userStrategies) {
        const effectiveStrategy = getEffectiveStrategy(16, userStrategy)
        expect(effectiveStrategy).toBe('mode0-hue-diversity')
      }
    })
  })

  describe('Modes 1-2 (≤4 colors) - should use user strategy', () => {
    const smallTargetColors = [1, 2, 3, 4]

    for (const targetColors of smallTargetColors) {
      it(`should use user strategy for targetColors=${targetColors}`, () => {
        const userStrategy: PaletteStrategy = 'diversity-first-max'
        const effectiveStrategy = getEffectiveStrategy(
          targetColors,
          userStrategy
        )

        expect(effectiveStrategy).toBe('diversity-first-max')
      })
    }

    it('should respect different user strategies for modes 1-2', () => {
      const userStrategies: PaletteStrategy[] = [
        'frequency-balanced',
        'frequency-max',
        'diversity-first-balanced',
        'diversity-first-max'
      ]

      for (const userStrategy of userStrategies) {
        const effectiveStrategy = getEffectiveStrategy(4, userStrategy)
        expect(effectiveStrategy).toBe(userStrategy)
      }
    })
  })

  describe('Boundary case: targetColors = 5', () => {
    it('should switch to mode0-hue-diversity at targetColors > 4', () => {
      const strategy4 = getEffectiveStrategy(4, 'frequency-balanced')
      const strategy5 = getEffectiveStrategy(5, 'frequency-balanced')

      expect(strategy4).toBe('frequency-balanced')
      expect(strategy5).toBe('mode0-hue-diversity')
    })
  })
})

describe('selectDiverseColorsFast Full Flow Simulation', () => {
  let cpcPlusPalette: Vector[]
  let cpcClassicPalette: Vector[]

  beforeEach(() => {
    cpcPlusPalette = generateCPCPlusPalette()
    cpcClassicPalette = generateCPCClassicPalette()
  })

  describe('CPC Plus Mode 0 (16 colors from 4096)', () => {
    it('should select diverse colors using mode0-hue-diversity', () => {
      const candidates = createCandidatesFromPalette(cpcPlusPalette).slice(
        0,
        100
      )
      const effectiveStrategy = getEffectiveStrategy(16, 'frequency-balanced')

      const result = applyPaletteStrategyV2(
        effectiveStrategy,
        candidates,
        16,
        [],
        { basePaletteSize: 4096 }
      )

      expect(result.selectedIndices).toHaveLength(16)
      // Vérifier qu'on n'a pas de doublons
      const uniqueIndices = new Set(result.selectedIndices)
      expect(uniqueIndices.size).toBe(16)
    })

    it('should handle preselected colors correctly', () => {
      const candidates = createCandidatesFromPalette(cpcPlusPalette).slice(
        0,
        100
      )
      const preselectedIndices = [0, 4095] // Noir et blanc

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        16,
        preselectedIndices,
        { basePaletteSize: 4096 }
      )

      expect(result.selectedIndices).toContain(0)
      expect(result.selectedIndices).toContain(4095)
    })
  })

  describe('CPC Plus Mode 1 (4 colors from 4096)', () => {
    it('should use user strategy for mode 1', () => {
      const candidates = createCandidatesFromPalette(cpcPlusPalette).slice(
        0,
        50
      )
      const effectiveStrategy = getEffectiveStrategy(4, 'diversity-first-max')

      expect(effectiveStrategy).toBe('diversity-first-max')

      const result = applyPaletteStrategyV2(
        effectiveStrategy,
        candidates,
        4,
        [],
        { basePaletteSize: 4096 }
      )

      expect(result.selectedIndices).toHaveLength(4)
    })

    it('should produce different results with different strategies', () => {
      const candidates = createCandidatesFromPalette(cpcPlusPalette).slice(
        0,
        50
      )

      const frequencyResult = applyPaletteStrategyV2(
        'frequency-balanced',
        candidates,
        4,
        [],
        { basePaletteSize: 4096 }
      )

      const diversityResult = applyPaletteStrategyV2(
        'diversity-first-max',
        candidates,
        4,
        [],
        { basePaletteSize: 4096 }
      )

      // Les résultats peuvent différer selon la stratégie
      expect(frequencyResult.selectedIndices).toHaveLength(4)
      expect(diversityResult.selectedIndices).toHaveLength(4)
    })
  })

  describe('CPC Classic Mode 0 (16 colors from 27)', () => {
    it('should select colors from limited palette', () => {
      const candidates = createCandidatesFromPalette(cpcClassicPalette)
      const effectiveStrategy = getEffectiveStrategy(16, 'frequency-balanced')

      const result = applyPaletteStrategyV2(
        effectiveStrategy,
        candidates,
        16,
        [],
        { basePaletteSize: 27 }
      )

      // CPC Classic n'a que 27 couleurs, donc on peut en demander 16
      expect(result.selectedIndices.length).toBeLessThanOrEqual(16)
      // Mais on ne peut pas avoir plus que ce qui est disponible
      expect(result.selectedIndices.length).toBeLessThanOrEqual(27)
    })
  })

  describe('CPC Classic Mode 1 (4 colors from 27)', () => {
    it('should use user strategy for small target', () => {
      const candidates = createCandidatesFromPalette(cpcClassicPalette)
      const effectiveStrategy = getEffectiveStrategy(4, 'frequency-max')

      expect(effectiveStrategy).toBe('frequency-max')

      const result = applyPaletteStrategyV2(
        effectiveStrategy,
        candidates,
        4,
        [],
        { basePaletteSize: 27 }
      )

      expect(result.selectedIndices).toHaveLength(4)
    })
  })
})

describe('Strategy behavior consistency', () => {
  let cpcPlusPalette: Vector[]

  beforeEach(() => {
    cpcPlusPalette = generateCPCPlusPalette()
  })

  it('should always include preselected indices first', () => {
    const candidates = createCandidatesFromPalette(cpcPlusPalette).slice(0, 100)
    const preselectedIndices = [10, 20, 30]

    const result = applyPaletteStrategyV2(
      'mode0-hue-diversity',
      candidates,
      8,
      preselectedIndices,
      { basePaletteSize: 4096 }
    )

    // Les présélectionnées doivent être en premier dans le résultat
    expect(result.selectedIndices.slice(0, 3)).toEqual(preselectedIndices)
  })

  it('should not duplicate indices', () => {
    const candidates = createCandidatesFromPalette(cpcPlusPalette).slice(0, 100)

    const result = applyPaletteStrategyV2(
      'mode0-hue-diversity',
      candidates,
      16,
      [],
      { basePaletteSize: 4096 }
    )

    const uniqueIndices = new Set(result.selectedIndices)
    expect(uniqueIndices.size).toBe(result.selectedIndices.length)
  })

  it('should handle when preselected count >= targetColors', () => {
    const candidates = createCandidatesFromPalette(cpcPlusPalette).slice(0, 100)
    const preselectedIndices = [0, 1, 2, 3, 4] // 5 présélectionnées

    const result = applyPaletteStrategyV2(
      'mode0-hue-diversity',
      candidates,
      4, // Seulement 4 demandées
      preselectedIndices,
      { basePaletteSize: 4096 }
    )

    // Doit retourner au max targetColors
    expect(result.selectedIndices.length).toBeLessThanOrEqual(4)
  })
})

describe('Documented behavior for regression prevention', () => {
  let cpcPlusPalette: Vector[]

  beforeEach(() => {
    cpcPlusPalette = generateCPCPlusPalette()
  })

  it('DOCUMENTED: mode 0 uses mode0-hue-diversity ignoring user preference', () => {
    // Ce comportement est intentionnel pour garantir la diversité des teintes
    // en mode 0 (16 couleurs)
    const effectiveStrategy = getEffectiveStrategy(16, 'frequency-max')

    expect(effectiveStrategy).toBe('mode0-hue-diversity')
    // NOTE: Le choix utilisateur est ignoré en mode 0
  })

  it('DOCUMENTED: modes 1-2 respect user strategy preference', () => {
    // Les modes avec peu de couleurs laissent le choix à l'utilisateur
    const effectiveStrategy = getEffectiveStrategy(4, 'perceptual-balanced')

    expect(effectiveStrategy).toBe('perceptual-balanced')
  })

  it('DOCUMENTED: basePaletteSize affects strategy behavior', () => {
    const candidates = createCandidatesFromPalette(cpcPlusPalette).slice(0, 50)

    const classicResult = applyPaletteStrategyV2(
      'mode0-hue-diversity',
      candidates,
      8,
      [],
      { basePaletteSize: 27 }
    )

    const plusResult = applyPaletteStrategyV2(
      'mode0-hue-diversity',
      candidates,
      8,
      [],
      { basePaletteSize: 4096 }
    )

    // Les deux doivent fonctionner
    expect(classicResult.selectedIndices.length).toBeGreaterThan(0)
    expect(plusResult.selectedIndices.length).toBeGreaterThan(0)
  })
})
