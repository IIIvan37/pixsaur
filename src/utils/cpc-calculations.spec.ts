import { describe, expect, it } from 'vitest'
import {
  getWidthStepForMode,
  getAspectRatioMultipliers,
  getPixelsPerByte,
  quantizeCPC,
  quantifyToCPCPlus
} from './cpc-calculations'

describe('cpc-calculations', () => {
  describe('getWidthStepForMode', () => {
    it('should return correct width step for mode 0', () => {
      expect(getWidthStepForMode(0)).toBe(4)
    })

    it('should return correct width step for mode 1', () => {
      expect(getWidthStepForMode(1)).toBe(8)
    })

    it('should return correct width step for mode 2', () => {
      expect(getWidthStepForMode(2)).toBe(16)
    })
  })

  describe('getAspectRatioMultipliers', () => {
    it('should return correct multipliers for mode 0 (wide pixels)', () => {
      const result = getAspectRatioMultipliers(0)
      expect(result.widthMultiplier).toBe(2)
      expect(result.heightMultiplier).toBe(1)
    })

    it('should return correct multipliers for mode 1 (square pixels)', () => {
      const result = getAspectRatioMultipliers(1)
      expect(result.widthMultiplier).toBe(1)
      expect(result.heightMultiplier).toBe(1)
    })

    it('should return correct multipliers for mode 2 (tall pixels)', () => {
      const result = getAspectRatioMultipliers(2)
      expect(result.widthMultiplier).toBe(1)
      expect(result.heightMultiplier).toBe(2)
    })
  })

  describe('getPixelsPerByte', () => {
    it('should return correct pixels per byte for mode 0', () => {
      expect(getPixelsPerByte(0)).toBe(2)
    })

    it('should return correct pixels per byte for mode 1', () => {
      expect(getPixelsPerByte(1)).toBe(4)
    })

    it('should return correct pixels per byte for mode 2', () => {
      expect(getPixelsPerByte(2)).toBe(8)
    })
  })

  describe('quantizeCPC', () => {
    it('should return 0 for values closest to 0', () => {
      expect(quantizeCPC(0)).toBe(0)
      expect(quantizeCPC(63)).toBe(0)
      expect(quantizeCPC(64)).toBe(0) // Equal distance, returns first value
    })

    it('should return 128 for values closest to 128', () => {
      expect(quantizeCPC(128)).toBe(128)
      expect(quantizeCPC(65)).toBe(128)
      expect(quantizeCPC(191)).toBe(128)
    })

    it('should return 255 for values closest to 255', () => {
      expect(quantizeCPC(255)).toBe(255)
      expect(quantizeCPC(192)).toBe(255)
    })

    it('should handle edge cases', () => {
      expect(quantizeCPC(-1)).toBe(0) // Negative values
      expect(quantizeCPC(256)).toBe(255) // Values above 255
    })
  })

  describe('quantifyToCPCPlus', () => {
    it('should correctly quantize to 4-bit values', () => {
      // Test some known conversions
      expect(quantifyToCPCPlus(0)).toBe(0)
      expect(quantifyToCPCPlus(255)).toBe(255)
      expect(quantifyToCPCPlus(128)).toBe(136) // 8/15 * 255 ≈ 136
    })

    it('should be symmetric for round-trip conversion', () => {
      // Test that converting back and forth gives consistent results
      const testValues = [0, 63, 127, 191, 255]
      for (const value of testValues) {
        const quantized = quantifyToCPCPlus(value)
        const val4bit = Math.round((value / 255) * 15)
        const expected = Math.round((val4bit / 15) * 255)
        expect(quantized).toBe(expected)
      }
    })

    it('should handle edge cases', () => {
      expect(quantifyToCPCPlus(-1)).toBe(0) // Negative values
      expect(quantifyToCPCPlus(256)).toBe(255) // Values above 255
    })
  })
})