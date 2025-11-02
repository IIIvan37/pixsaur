import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { paletteStrategyAtom, setPaletteStrategyAtom } from './config'
import type { PaletteStrategy } from './types'

describe('Palette Strategy Configuration Atoms', () => {
  describe('paletteStrategyAtom', () => {
    it('should have frequency-balanced as default value', () => {
      const store = createStore()
      const value = store.get(paletteStrategyAtom)

      expect(value).toBe('frequency-balanced')
    })

    it('should store all 9 valid strategy values', () => {
      const store = createStore()
      const strategies: PaletteStrategy[] = [
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

      for (const strategy of strategies) {
        store.set(paletteStrategyAtom, strategy)
        expect(store.get(paletteStrategyAtom)).toBe(strategy)
      }
    })
  })

  describe('setPaletteStrategyAtom', () => {
    it('should update paletteStrategyAtom when executed', () => {
      const store = createStore()

      expect(store.get(paletteStrategyAtom)).toBe('frequency-balanced')

      store.set(setPaletteStrategyAtom, 'diversity-first-max')

      expect(store.get(paletteStrategyAtom)).toBe('diversity-first-max')
    })

    it('should allow changing strategy multiple times', () => {
      const store = createStore()

      store.set(setPaletteStrategyAtom, 'perceptual-balanced')
      expect(store.get(paletteStrategyAtom)).toBe('perceptual-balanced')

      store.set(setPaletteStrategyAtom, 'balanced-score-max')
      expect(store.get(paletteStrategyAtom)).toBe('balanced-score-max')

      store.set(setPaletteStrategyAtom, 'adaptive')
      expect(store.get(paletteStrategyAtom)).toBe('adaptive')
    })
  })

  describe('Strategy type safety', () => {
    it('should only accept valid PaletteStrategy values', () => {
      const store = createStore()

      // Valid strategies
      const validStrategies: PaletteStrategy[] = [
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

      // TypeScript should enforce this at compile time
      for (const strategy of validStrategies) {
        expect(() => {
          store.set(setPaletteStrategyAtom, strategy)
        }).not.toThrow()
      }
    })
  })

  describe('Integration with other atoms', () => {
    it('should work independently from other config atoms', () => {
      const store = createStore()

      // Change strategy
      store.set(setPaletteStrategyAtom, 'perceptual-max')

      // Strategy should be updated
      expect(store.get(paletteStrategyAtom)).toBe('perceptual-max')

      // Other atoms should not be affected (implicit test)
    })
  })
})
