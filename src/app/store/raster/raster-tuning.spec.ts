/**
 * Tests for raster tuning atoms
 */

import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PREPROCESS_CONTINUITY_BONUS,
  PREPROCESS_CONTINUITY_DISTANCE,
  PREPROCESS_FREQUENCY_EXPONENT,
  VERTICAL_ERROR_COEFFICIENT
} from '@/libs/pixsaur-raster/raster-constants'
import {
  horizontalErrorCoefficientAtom,
  preprocessContinuityBonusAtom,
  preprocessContinuityDistanceAtom,
  preprocessFrequencyExponentAtom,
  rasterTuningEnabledAtom,
  verticalErrorCoefficientAtom
} from './raster-tuning'

describe('raster-tuning atoms', () => {
  describe('rasterTuningEnabledAtom', () => {
    it('should have default value of false', () => {
      const store = createStore()
      expect(store.get(rasterTuningEnabledAtom)).toBe(false)
    })

    it('should be settable to true', () => {
      const store = createStore()
      store.set(rasterTuningEnabledAtom, true)
      expect(store.get(rasterTuningEnabledAtom)).toBe(true)
    })
  })

  describe('verticalErrorCoefficientAtom', () => {
    it('should have default value from constants', () => {
      const store = createStore()
      expect(store.get(verticalErrorCoefficientAtom)).toBe(
        VERTICAL_ERROR_COEFFICIENT
      )
    })

    it('should be settable', () => {
      const store = createStore()
      store.set(verticalErrorCoefficientAtom, 0.25)
      expect(store.get(verticalErrorCoefficientAtom)).toBe(0.25)
    })
  })

  describe('horizontalErrorCoefficientAtom', () => {
    it('should have default value from constants', () => {
      const store = createStore()
      expect(store.get(horizontalErrorCoefficientAtom)).toBe(
        HORIZONTAL_ERROR_COEFFICIENT
      )
    })

    it('should be settable', () => {
      const store = createStore()
      store.set(horizontalErrorCoefficientAtom, 0.75)
      expect(store.get(horizontalErrorCoefficientAtom)).toBe(0.75)
    })
  })

  describe('preprocessContinuityDistanceAtom', () => {
    it('should have default value from constants', () => {
      const store = createStore()
      expect(store.get(preprocessContinuityDistanceAtom)).toBe(
        PREPROCESS_CONTINUITY_DISTANCE
      )
    })

    it('should be settable', () => {
      const store = createStore()
      store.set(preprocessContinuityDistanceAtom, 1000)
      expect(store.get(preprocessContinuityDistanceAtom)).toBe(1000)
    })
  })

  describe('preprocessContinuityBonusAtom', () => {
    it('should have default value from constants', () => {
      const store = createStore()
      expect(store.get(preprocessContinuityBonusAtom)).toBe(
        PREPROCESS_CONTINUITY_BONUS
      )
    })

    it('should be settable', () => {
      const store = createStore()
      store.set(preprocessContinuityBonusAtom, 2.0)
      expect(store.get(preprocessContinuityBonusAtom)).toBe(2.0)
    })
  })

  describe('preprocessFrequencyExponentAtom', () => {
    it('should have default value from constants', () => {
      const store = createStore()
      expect(store.get(preprocessFrequencyExponentAtom)).toBe(
        PREPROCESS_FREQUENCY_EXPONENT
      )
    })

    it('should be settable', () => {
      const store = createStore()
      store.set(preprocessFrequencyExponentAtom, 0.7)
      expect(store.get(preprocessFrequencyExponentAtom)).toBe(0.7)
    })
  })
})
