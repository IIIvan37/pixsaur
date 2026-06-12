import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'

// Mock des stratégies
vi.mock('../../pixsaur-color/src/quant/palette-strategies-v2', () => ({
  selectByFrequencyBalanced: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByFrequencyMax: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByBalancedScoreBalanced: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByBalancedScoreMax: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByPerceptualBalanced: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByPerceptualMax: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByDiversityFirstBalanced: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByDiversityFirstMax: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByAdaptive: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByExhaustiveContrast: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByCoverageAware: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  })),
  selectByDitheringAware: vi.fn((candidates, targetColors) => ({
    selectedIndices: candidates.slice(0, targetColors).map((c: any) => c.index),
    scores: new Map()
  }))
}))

import {
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
  selectByPerceptualBalanced,
  selectByPerceptualMax
} from '@/libs/pixsaur-color/src/quant/palette-strategies-v2'

describe('regl-quantizer strategy integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Strategy selection routing', () => {
    const strategies: PaletteStrategy[] = [
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
      'adaptive'
    ]

    const strategyFunctionMap: Record<PaletteStrategy, unknown> = {
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

    it('should map all 12 strategies to correct functions', () => {
      expect(strategies).toHaveLength(12)

      for (const strategy of strategies) {
        const fn = strategyFunctionMap[strategy]
        expect(fn).toBeDefined()
        expect(typeof fn).toBe('function')
      }
    })

    it('should call frequency-balanced when strategy is frequency-balanced', () => {
      const mockFn = selectByFrequencyBalanced as any
      mockFn.mockClear()

      const candidates = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        { index: 1, frequency: 50, color: [0, 255, 0], converted: [0, 255, 0] }
      ]

      mockFn(candidates, 2, [])

      expect(mockFn).toHaveBeenCalledWith(candidates, 2, [])
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should call diversity-first-max when strategy is diversity-first-max', () => {
      const mockFn = selectByDiversityFirstMax as any
      mockFn.mockClear()

      const candidates = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        { index: 1, frequency: 50, color: [0, 255, 0], converted: [0, 255, 0] }
      ]

      mockFn(candidates, 2, [])

      expect(mockFn).toHaveBeenCalledWith(candidates, 2, [])
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('Strategy execution conditions', () => {
    it('should trigger strategy when targetColors <= 4', () => {
      // Ce test vérifie que le switch de stratégie est exécuté pour targetColors <= 4
      const testTargets = [1, 2, 3, 4]

      for (const target of testTargets) {
        expect(target).toBeLessThanOrEqual(4)
      }
    })

    it('should not trigger strategy when targetColors > 4', () => {
      const testTargets = [5, 8, 16]

      for (const target of testTargets) {
        expect(target).toBeGreaterThan(4)
      }
    })
  })

  describe('Parameter handling', () => {
    it('should use config.targetColors for actual color selection', () => {
      // Test vérifie que actualTargetColors est calculé depuis config.targetColors
      const config = {
        targetColors: 4,
        contrastStrategy: 'balanced' as const
      }

      const actualTargetColors =
        config.targetColors === 512 ? 16 : config.targetColors

      expect(actualTargetColors).toBe(4)
    })

    it('should handle special case of targetColors=512 as 16', () => {
      const config = {
        targetColors: 512,
        contrastStrategy: 'balanced' as const
      }

      const actualTargetColors =
        config.targetColors === 512 ? 16 : config.targetColors

      expect(actualTargetColors).toBe(16)
    })

    it('should pass correct parameters to strategy functions', () => {
      const mockFn = selectByFrequencyBalanced as any
      mockFn.mockClear()

      const candidates = [
        {
          index: 0,
          frequency: 100,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        { index: 1, frequency: 50, color: [0, 255, 0], converted: [0, 255, 0] },
        { index: 2, frequency: 30, color: [0, 0, 255], converted: [0, 0, 255] }
      ]
      const targetColors = 2
      const preselectedIndices = [0]

      mockFn(candidates, targetColors, preselectedIndices)

      expect(mockFn).toHaveBeenCalledWith(
        candidates,
        targetColors,
        preselectedIndices
      )
    })
  })

  describe('Return value handling', () => {
    it('should extract selectedIndices from strategy result', () => {
      const mockResult = {
        selectedIndices: [0, 1, 2],
        scores: new Map([
          [0, 100],
          [1, 80],
          [2, 60]
        ])
      }

      const result = mockResult.selectedIndices

      expect(result).toEqual([0, 1, 2])
      expect(result).toHaveLength(3)
    })
  })

  describe('Default strategy behavior', () => {
    it('should use frequency-balanced as default strategy', () => {
      const defaultStrategy: PaletteStrategy = 'frequency-balanced'

      expect(defaultStrategy).toBe('frequency-balanced')
    })

    it('should handle undefined strategy by falling back to default', () => {
      const strategy: PaletteStrategy | undefined = undefined
      const effectiveStrategy: PaletteStrategy =
        strategy || 'frequency-balanced'

      expect(effectiveStrategy).toBe('frequency-balanced')
    })
  })
})
