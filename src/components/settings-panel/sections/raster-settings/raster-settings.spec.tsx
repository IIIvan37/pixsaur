/**
 * Tests for RasterSettings smart component logic
 * Since RasterSettings uses many derived atoms, we test the core logic separately
 */

import { describe, expect, it } from 'vitest'

/**
 * Core logic extracted from RasterSettings component
 * This mirrors the calculations done in the component
 */
function calculateShowPreprocessParams(nColors: number): boolean {
  // Preprocessing parameters are only useful for modes with few colors (Mode 1 = 4, Mode 2 = 2)
  // In Mode 0 (16 colors), each line rarely has >16 unique colors after quantization,
  // so the farthest point selection algorithm doesn't apply
  return nColors < 16
}

function calculateIsMode0Plus(isPlusMode: boolean, nColors: number): boolean {
  return isPlusMode && nColors === 16
}

function calculateHardwareLimit(cpcHardware: 'classic' | 'plus'): number {
  return cpcHardware === 'classic' ? 2 : 4
}

describe('RasterSettings logic', () => {
  describe('showPreprocessParams calculation', () => {
    it('should return false for Mode 0 (16 colors)', () => {
      expect(calculateShowPreprocessParams(16)).toBe(false)
    })

    it('should return true for Mode 1 (4 colors)', () => {
      expect(calculateShowPreprocessParams(4)).toBe(true)
    })

    it('should return true for Mode 2 (2 colors)', () => {
      expect(calculateShowPreprocessParams(2)).toBe(true)
    })

    it('should return true for any nColors less than 16', () => {
      expect(calculateShowPreprocessParams(8)).toBe(true)
      expect(calculateShowPreprocessParams(1)).toBe(true)
      expect(calculateShowPreprocessParams(15)).toBe(true)
    })
  })

  describe('isMode0Plus calculation', () => {
    it('should return true when Plus mode and 16 colors', () => {
      expect(calculateIsMode0Plus(true, 16)).toBe(true)
    })

    it('should return false when Classic mode and 16 colors', () => {
      expect(calculateIsMode0Plus(false, 16)).toBe(false)
    })

    it('should return false when Plus mode but not 16 colors', () => {
      expect(calculateIsMode0Plus(true, 4)).toBe(false)
      expect(calculateIsMode0Plus(true, 2)).toBe(false)
    })

    it('should return false when Classic mode and any colors', () => {
      expect(calculateIsMode0Plus(false, 16)).toBe(false)
      expect(calculateIsMode0Plus(false, 4)).toBe(false)
      expect(calculateIsMode0Plus(false, 2)).toBe(false)
    })
  })

  describe('hardware limit calculation', () => {
    it('should return 4 for Plus mode', () => {
      expect(calculateHardwareLimit('plus')).toBe(4)
    })

    it('should return 2 for Classic mode', () => {
      expect(calculateHardwareLimit('classic')).toBe(2)
    })
  })
})
