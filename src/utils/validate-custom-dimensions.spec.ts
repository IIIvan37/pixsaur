import { describe, expect, it } from 'vitest'
import {
  getHeightStep,
  getMaxDimensions,
  getWidthStep,
  validateCustomDimensions
} from './validate-custom-dimensions'

describe('validateCustomDimensions', () => {
  describe('Mode 0 (2 pixels/byte, width % 4)', () => {
    it('should validate standard 160×200', () => {
      const result = validateCustomDimensions(160, 200, 0)
      expect(result.valid).toBe(true)
      expect(result.widthInBytes).toBe(80)
      expect(result.bytes).toBe(16000)
      expect(result.kb).toBeCloseTo(15.625, 3)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate custom 164×248', () => {
      const result = validateCustomDimensions(164, 248, 0)
      expect(result.valid).toBe(true)
      expect(result.widthInBytes).toBe(82)
      expect(result.bytes).toBe(20336)
    })

    it('should reject width not multiple of 4', () => {
      const result = validateCustomDimensions(162, 200, 0)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Width must be multiple of 4 for Mode 0')
    })

    it('should reject height not multiple of 8', () => {
      const result = validateCustomDimensions(160, 201, 0)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'Height must be multiple of 8 (CPC interlacing)'
      )
    })

    it('should reject odd widthInBytes', () => {
      // 2 pixels in mode 0 = 1 byte (odd)
      // But width must be multiple of 4, so minimum valid is 4 pixels = 2 bytes
      // To get odd widthInBytes, we need a width that's not multiple of 4
      // Actually, if width % 4 === 0, then widthInBytes will always be even
      // So this test should check that validation catches this edge case
      const result = validateCustomDimensions(6, 8, 0) // 6 % 4 = 2 (invalid width)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Width must be multiple of 4 for Mode 0')
    })

    it('should reject dimensions exceeding 64 Ko', () => {
      const result = validateCustomDimensions(512, 512, 0)
      expect(result.valid).toBe(false)
      expect(result.bytes).toBe(131072) // 512/2 = 256 bytes/line, 256 * 512 = 131072
      expect(result.errors).toContain(
        'Memory usage 128.00 Ko exceeds 64 Ko limit'
      )
    })
  })

  describe('Mode 1 (4 pixels/byte, width % 8)', () => {
    it('should validate standard 320×200', () => {
      const result = validateCustomDimensions(320, 200, 1)
      expect(result.valid).toBe(true)
      expect(result.widthInBytes).toBe(80)
      expect(result.bytes).toBe(16000)
    })

    it('should validate custom 328×248', () => {
      const result = validateCustomDimensions(328, 248, 1)
      expect(result.valid).toBe(true)
      expect(result.widthInBytes).toBe(82)
      expect(result.bytes).toBe(20336)
    })

    it('should reject width not multiple of 8', () => {
      const result = validateCustomDimensions(324, 200, 1)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Width must be multiple of 8 for Mode 1')
    })
  })

  describe('Mode 2 (8 pixels/byte, width % 16)', () => {
    it('should validate standard 640×200', () => {
      const result = validateCustomDimensions(640, 200, 2)
      expect(result.valid).toBe(true)
      expect(result.widthInBytes).toBe(80)
      expect(result.bytes).toBe(16000)
    })

    it('should validate custom 656×248', () => {
      const result = validateCustomDimensions(656, 248, 2)
      expect(result.valid).toBe(true)
      expect(result.widthInBytes).toBe(82)
      expect(result.bytes).toBe(20336)
    })

    it('should reject width not multiple of 16', () => {
      const result = validateCustomDimensions(648, 200, 2)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Width must be multiple of 16 for Mode 2')
    })
  })

  describe('Edge cases', () => {
    it('should validate minimum dimensions (4×8 for Mode 0)', () => {
      const result = validateCustomDimensions(8, 8, 0)
      expect(result.valid).toBe(true)
      expect(result.widthInBytes).toBe(4)
      expect(result.bytes).toBe(32)
    })

    it('should reject zero dimensions', () => {
      const result = validateCustomDimensions(0, 0, 0)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject negative dimensions', () => {
      const result = validateCustomDimensions(-160, -200, 0)
      expect(result.valid).toBe(false)
    })
  })
})

describe('getWidthStep', () => {
  it('should return 4 for Mode 0', () => {
    expect(getWidthStep(0)).toBe(4)
  })

  it('should return 8 for Mode 1', () => {
    expect(getWidthStep(1)).toBe(8)
  })

  it('should return 16 for Mode 2', () => {
    expect(getWidthStep(2)).toBe(16)
  })
})

describe('getHeightStep', () => {
  it('should always return 8', () => {
    expect(getHeightStep()).toBe(8)
  })
})

describe('getMaxDimensions', () => {
  it('should calculate max dimensions for Mode 0 with 64 Ko', () => {
    const max = getMaxDimensions(0, 65536)
    expect(max.width % 4).toBe(0)
    expect(max.height % 8).toBe(0)

    const result = validateCustomDimensions(max.width, max.height, 0)
    expect(result.valid).toBe(true)
    expect(result.bytes).toBeLessThanOrEqual(65536)
  })

  it('should calculate max dimensions for Mode 1 with 16 Ko', () => {
    const max = getMaxDimensions(1, 16384)
    expect(max.width % 8).toBe(0)
    expect(max.height % 8).toBe(0)

    const result = validateCustomDimensions(max.width, max.height, 1)
    expect(result.valid).toBe(true)
    expect(result.bytes).toBeLessThanOrEqual(16384)
  })

  it('should calculate max dimensions for Mode 2 with 64 Ko', () => {
    const max = getMaxDimensions(2, 65536)
    expect(max.width % 16).toBe(0)
    expect(max.height % 8).toBe(0)

    const result = validateCustomDimensions(max.width, max.height, 2)
    expect(result.valid).toBe(true)
    expect(result.bytes).toBeLessThanOrEqual(65536)
  })
})
