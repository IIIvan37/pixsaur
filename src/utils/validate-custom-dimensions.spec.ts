import { describe, expect, it } from 'vitest'
import {
  type ValidationResult,
  validateCustomDimensions
} from './validate-custom-dimensions'

describe('validateCustomDimensions', () => {
  describe('Valid dimensions', () => {
    it('should validate correct dimensions for mode 0', () => {
      const result: ValidationResult = validateCustomDimensions(160, 200, 0)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.bytes).toBe(16000) // 160/2 * 200 = 80 * 200 = 16000 bytes (15.625 KB)
      expect(result.kb).toBeCloseTo(15.625, 2)
    })

    it('should validate correct dimensions for mode 1', () => {
      const result: ValidationResult = validateCustomDimensions(320, 200, 1)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.bytes).toBe(16000) // 320/4 * 200 = 80 * 200 = 16000 bytes (15.625 KB)
      expect(result.kb).toBe(15.625)
    })

    it('should validate correct dimensions for mode 2', () => {
      const result: ValidationResult = validateCustomDimensions(640, 200, 2)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.bytes).toBe(16000) // 640/8 * 200 = 80 * 200 = 16000 bytes (15.625 KB)
      expect(result.kb).toBe(15.625)
    })

    it('should validate minimum valid dimensions', () => {
      const result: ValidationResult = validateCustomDimensions(16, 8, 2)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.bytes).toBe(16) // 16/8 * 8 = 2 * 8
      expect(result.kb).toBeCloseTo(0.015625, 5)
    })
  })

  describe('Width validation', () => {
    it('should reject width not multiple of widthStep for mode 0', () => {
      const result: ValidationResult = validateCustomDimensions(162, 200, 0)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Largeur doit être multiple de 4')
    })

    it('should reject width not multiple of widthStep for mode 1', () => {
      const result: ValidationResult = validateCustomDimensions(322, 200, 1)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Largeur doit être multiple de 8')
    })

    it('should reject width not multiple of widthStep for mode 2', () => {
      const result: ValidationResult = validateCustomDimensions(642, 200, 2)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Largeur doit être multiple de 16')
    })

    it('should reject odd width in bytes', () => {
      // Mode 0: 2 pixels per byte, so 6 pixels = 3 bytes (odd)
      const result: ValidationResult = validateCustomDimensions(6, 8, 0)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Largeur en octets (3) doit être paire')
    })
  })

  describe('Height validation', () => {
    it('should reject height not multiple of 8', () => {
      const result: ValidationResult = validateCustomDimensions(160, 202, 0)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Hauteur doit être multiple de 8')
    })

    it('should accept height 8', () => {
      const result: ValidationResult = validateCustomDimensions(160, 8, 0)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should accept large heights that are multiples of 8', () => {
      const result: ValidationResult = validateCustomDimensions(160, 400, 0)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })
  })

  describe('Memory limit validation', () => {
    it('should reject dimensions exceeding 64KB', () => {
      // Mode 2: 640x832 = (640/8) * 832 = 80 * 832 = 66560 bytes > 65536
      const result: ValidationResult = validateCustomDimensions(640, 832, 2)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Mémoire 65.00 Ko dépasse 64 Ko')
    })

    it('should accept exactly 64KB', () => {
      // Mode 1: 320x256 = 81920 bytes, but wait...
      // Actually, let's calculate properly for mode 1:
      // pixelsPerByte = 4, so 320 pixels = 80 bytes width
      // 80 bytes * 256 height = 20480 bytes = 20KB
      // For exactly 64KB: 65536 / 256 = 256 bytes width
      // 256 bytes * 4 pixels/byte = 1024 pixels width
      const result: ValidationResult = validateCustomDimensions(1024, 256, 1)

      expect(result.valid).toBe(true)
      expect(result.bytes).toBe(65536)
      expect(result.kb).toBe(64)
    })

    it('should calculate memory correctly for different modes', () => {
      // All these examples give 80 bytes width, so same total bytes
      // Mode 0: 160x200 = (160/2) * 200 = 80 * 200 = 16000 bytes
      const result0: ValidationResult = validateCustomDimensions(160, 200, 0)
      expect(result0.bytes).toBe(16000)
      expect(result0.kb).toBeCloseTo(15.625, 2)

      // Mode 1: 320x200 = (320/4) * 200 = 80 * 200 = 16000 bytes
      const result1: ValidationResult = validateCustomDimensions(320, 200, 1)
      expect(result1.bytes).toBe(16000)
      expect(result1.kb).toBe(15.625)

      // Mode 2: 640x200 = (640/8) * 200 = 80 * 200 = 16000 bytes
      const result2: ValidationResult = validateCustomDimensions(640, 200, 2)
      expect(result2.bytes).toBe(16000)
      expect(result2.kb).toBe(15.625)
    })
  })

  describe('Multiple validation errors', () => {
    it('should report all validation errors', () => {
      // Invalid: width not multiple of 16, odd byte width, height not multiple of 8
      const result: ValidationResult = validateCustomDimensions(100, 100, 2)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(3)
      expect(result.errors).toContain('Largeur doit être multiple de 16')
      expect(result.errors).toContain(
        'Largeur en octets (12.5) doit être paire'
      )
      expect(result.errors).toContain('Hauteur doit être multiple de 8')
    })

    it('should handle edge case with very small invalid dimensions', () => {
      const result: ValidationResult = validateCustomDimensions(1, 1, 0)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Edge cases', () => {
    it('should handle zero dimensions', () => {
      const result: ValidationResult = validateCustomDimensions(0, 0, 0)

      expect(result.valid).toBe(true) // Zero dimensions are technically valid
      expect(result.errors).toEqual([])
      expect(result.bytes).toBe(0)
      expect(result.kb).toBe(0)
    })

    it('should handle negative dimensions', () => {
      const result: ValidationResult = validateCustomDimensions(-160, -200, 0)

      expect(result.valid).toBe(true) // Negative dimensions pass validation (though not practical)
      expect(result.errors).toEqual([])
    })

    it('should handle very large dimensions', () => {
      const result: ValidationResult = validateCustomDimensions(10000, 10000, 2)

      expect(result.valid).toBe(false)
      expect(result.errors.some((error) => error.includes('Mémoire'))).toBe(
        true
      )
    })
  })
})
