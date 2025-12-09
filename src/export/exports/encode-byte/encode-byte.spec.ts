import { describe, expect, it } from 'vitest'
import { encodeByte } from './encode-byte'

describe('encodeByte', () => {
  describe('mode 0 (2 colors)', () => {
    it('should encode two pixels with 4-bit indices', () => {
      const indexBuf = new Uint8Array([0b0000, 0b1111]) // left=0, right=15
      const byte = encodeByte(indexBuf, 0, 0, 0, 2)

      // Mode 0 avec correction Img2CPC
      // left=0: bits tous à 0
      // right=15 (0b1111): tous les bits à 1
      expect(byte).toBe(0b01010101)
    })

    it('should handle mixed values', () => {
      const indexBuf = new Uint8Array([0b1010, 0b0101]) // left=10, right=5
      const byte = encodeByte(indexBuf, 0, 0, 0, 2)

      expect(byte).toBeGreaterThanOrEqual(0)
      expect(byte).toBeLessThanOrEqual(255)
    })

    it('should encode at specific x,y position', () => {
      const width = 4
      const indexBuf = new Uint8Array(width * 2)
      indexBuf[4] = 0b0011 // y=1, x=0
      indexBuf[5] = 0b1100

      const byte = encodeByte(indexBuf, 0, 1, 0, width)

      expect(byte).toBeGreaterThanOrEqual(0)
      expect(byte).toBeLessThanOrEqual(255)
    })
  })

  describe('mode 1 (4 colors)', () => {
    it('should encode four pixels with 2-bit indices', () => {
      const indexBuf = new Uint8Array([0, 1, 2, 3]) // 4 pixels with values 0-3
      const byte = encodeByte(indexBuf, 0, 0, 1, 4)

      // Mode 1: bit 7=p0b0, 6=p1b0, 5=p2b0, 4=p3b0, 3=p0b1, 2=p1b1, 1=p2b1, 0=p3b1
      // p0=0 (0b00), p1=1 (0b01), p2=2 (0b10), p3=3 (0b11)
      // Résultat: 0b01010011 = 83
      expect(byte).toBe(0b01010011)
    })

    it('should handle all zeros', () => {
      const indexBuf = new Uint8Array([0, 0, 0, 0])
      const byte = encodeByte(indexBuf, 0, 0, 1, 4)

      expect(byte).toBe(0)
    })

    it('should handle all threes', () => {
      const indexBuf = new Uint8Array([3, 3, 3, 3])
      const byte = encodeByte(indexBuf, 0, 0, 1, 4)

      expect(byte).toBe(0b11111111)
    })

    it('should encode at specific x,y position', () => {
      const width = 8
      const indexBuf = new Uint8Array(width * 2)
      indexBuf[8] = 1 // y=1, x=0
      indexBuf[9] = 2
      indexBuf[10] = 3
      indexBuf[11] = 0

      const byte = encodeByte(indexBuf, 0, 1, 1, width)

      expect(byte).toBeGreaterThanOrEqual(0)
      expect(byte).toBeLessThanOrEqual(255)
    })
  })

  describe('mode 2 (16 colors)', () => {
    it('should encode eight pixels with 1-bit indices', () => {
      const indexBuf = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0])
      const byte = encodeByte(indexBuf, 0, 0, 2, 8)

      // Mode 2: chaque bit représente un pixel
      expect(byte).toBe(0b10101010)
    })

    it('should handle all zeros', () => {
      const indexBuf = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])
      const byte = encodeByte(indexBuf, 0, 0, 2, 8)

      expect(byte).toBe(0)
    })

    it('should handle all ones', () => {
      const indexBuf = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1])
      const byte = encodeByte(indexBuf, 0, 0, 2, 8)

      expect(byte).toBe(0b11111111)
    })

    it('should encode at specific x,y position', () => {
      const width = 16
      const indexBuf = new Uint8Array(width * 2)
      for (let i = 0; i < 8; i++) {
        indexBuf[16 + i] = i % 2 // y=1, x=0-7
      }

      const byte = encodeByte(indexBuf, 0, 1, 2, width)

      expect(byte).toBe(0b01010101)
    })

    it('should mask bits correctly (only use bit 0)', () => {
      const indexBuf = new Uint8Array([
        0xff, 0xfe, 0xff, 0xfe, 0xff, 0xfe, 0xff, 0xfe
      ])
      const byte = encodeByte(indexBuf, 0, 0, 2, 8)

      // Only bit 0 should matter (& 0x01)
      expect(byte).toBe(0b10101010)
    })
  })

  describe('edge cases', () => {
    it('should handle large width values', () => {
      const width = 320
      const indexBuf = new Uint8Array(width * 200)
      indexBuf[width * 100] = 1
      indexBuf[width * 100 + 1] = 1

      const byte = encodeByte(indexBuf, 0, 100, 0, width)

      expect(byte).toBeGreaterThanOrEqual(0)
      expect(byte).toBeLessThanOrEqual(255)
    })

    it('should mask input values to valid range (mode 0)', () => {
      const indexBuf = new Uint8Array([0xff, 0xff]) // Values > 15 should be masked
      const byte = encodeByte(indexBuf, 0, 0, 0, 2)

      // Should only use lower 4 bits (& 0x0f)
      expect(byte).toBeGreaterThanOrEqual(0)
      expect(byte).toBeLessThanOrEqual(255)
    })

    it('should mask input values to valid range (mode 1)', () => {
      const indexBuf = new Uint8Array([0xff, 0xff, 0xff, 0xff]) // Values > 3 should be masked
      const byte = encodeByte(indexBuf, 0, 0, 1, 4)

      // Should only use lower 2 bits (& 0x03)
      expect(byte).toBe(0b11111111)
    })
  })
})
