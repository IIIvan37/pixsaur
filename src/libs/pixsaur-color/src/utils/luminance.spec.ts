import { describe, expect, it } from 'vitest'
import {
  isBright,
  isDark,
  luminance,
  luminanceGammaCorrected
} from './luminance'

describe('luminance utilities', () => {
  describe('luminance', () => {
    it('should return 0 for black', () => {
      expect(luminance([0, 0, 0])).toBe(0)
    })

    it('should return 1 for white', () => {
      expect(luminance([255, 255, 255])).toBe(1)
    })

    it('should calculate luminance for red', () => {
      const result = luminance([255, 0, 0])
      expect(result).toBeCloseTo(0.2126, 4)
    })

    it('should calculate luminance for green', () => {
      const result = luminance([0, 255, 0])
      expect(result).toBeCloseTo(0.7152, 4)
    })

    it('should calculate luminance for blue', () => {
      const result = luminance([0, 0, 255])
      expect(result).toBeCloseTo(0.0722, 4)
    })

    it('should calculate luminance for gray', () => {
      const result = luminance([128, 128, 128])
      expect(result).toBeCloseTo(0.502, 3)
    })

    it('should calculate luminance for mixed color', () => {
      const result = luminance([100, 150, 200])
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })
  })

  describe('luminanceGammaCorrected', () => {
    it('should return 0 for black', () => {
      expect(luminanceGammaCorrected([0, 0, 0])).toBe(0)
    })

    it('should return 1 for white', () => {
      expect(luminanceGammaCorrected([255, 255, 255])).toBe(1)
    })

    it('should apply gamma correction for red', () => {
      const result = luminanceGammaCorrected([255, 0, 0])
      expect(result).toBeCloseTo(0.2126, 4)
    })

    it('should apply gamma correction for green', () => {
      const result = luminanceGammaCorrected([0, 255, 0])
      expect(result).toBeCloseTo(0.7152, 4)
    })

    it('should apply gamma correction for blue', () => {
      const result = luminanceGammaCorrected([0, 0, 255])
      expect(result).toBeCloseTo(0.0722, 4)
    })

    it('should handle dark colors with gamma correction', () => {
      // Dark colors should use linear formula: normalized / 12.92
      const result = luminanceGammaCorrected([10, 10, 10])
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(0.1)
    })

    it('should handle bright colors with gamma correction', () => {
      // Bright colors should use power formula
      const result = luminanceGammaCorrected([200, 200, 200])
      expect(result).toBeGreaterThan(0.5)
      expect(result).toBeLessThan(1)
    })

    it('should differ from simple luminance for mid-tones', () => {
      const simple = luminance([128, 128, 128])
      const corrected = luminanceGammaCorrected([128, 128, 128])
      expect(corrected).not.toBe(simple)
    })
  })

  describe('isDark', () => {
    it('should return true for black', () => {
      expect(isDark([0, 0, 0])).toBe(true)
    })

    it('should return false for white', () => {
      expect(isDark([255, 255, 255])).toBe(false)
    })

    it('should return true for dark colors', () => {
      expect(isDark([20, 20, 20])).toBe(true)
      expect(isDark([50, 50, 50])).toBe(true)
    })

    it('should return false for bright colors', () => {
      expect(isDark([200, 200, 200])).toBe(false)
      expect(isDark([255, 0, 0])).toBe(false)
    })

    it('should use threshold of 0.2', () => {
      // Color with luminance just below 0.2
      expect(isDark([40, 40, 40])).toBe(true)
      // Color with luminance just above 0.2
      expect(isDark([60, 60, 60])).toBe(false)
    })
  })

  describe('isBright', () => {
    it('should return false for black', () => {
      expect(isBright([0, 0, 0])).toBe(false)
    })

    it('should return true for white', () => {
      expect(isBright([255, 255, 255])).toBe(true)
    })

    it('should return true for very bright colors', () => {
      expect(isBright([240, 240, 240])).toBe(true)
      expect(isBright([255, 255, 200])).toBe(true)
    })

    it('should return false for dark colors', () => {
      expect(isBright([50, 50, 50])).toBe(false)
      expect(isBright([100, 100, 100])).toBe(false)
    })

    it('should use threshold of 0.8', () => {
      // Color with luminance just below 0.8
      expect(isBright([200, 200, 200])).toBe(false)
      // Color with luminance just above 0.8
      expect(isBright([220, 220, 220])).toBe(true)
    })
  })
})
