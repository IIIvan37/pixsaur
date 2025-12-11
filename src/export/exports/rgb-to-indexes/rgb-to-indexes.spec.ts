import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { rgbToIndexBufferExact } from './rgb-to-indexes'

describe('rgbToIndexBufferExact', () => {
  const createRGBABuffer = (
    pixels: Array<[number, number, number, number]>
  ): Uint8ClampedArray => {
    const buffer = new Uint8ClampedArray(pixels.length * 4)
    pixels.forEach(([r, g, b, a], i) => {
      buffer[i * 4] = r
      buffer[i * 4 + 1] = g
      buffer[i * 4 + 2] = b
      buffer[i * 4 + 3] = a
    })
    return buffer
  }

  describe('exact color matching', () => {
    it('should map pixels to correct palette indices', () => {
      const palette: Vector[] = [
        [0, 0, 0], // index 0: black
        [255, 0, 0], // index 1: red
        [0, 255, 0], // index 2: green
        [0, 0, 255] // index 3: blue
      ]

      // CPC quantized values: 0 -> 0, 255 -> 255
      const rgbaBuffer = createRGBABuffer([
        [0, 0, 0, 255], // should map to index 0
        [255, 0, 0, 255], // should map to index 1
        [0, 255, 0, 255], // should map to index 2
        [0, 0, 255, 255] // should map to index 3
      ])

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, false)

      expect(result[0]).toBe(0)
      expect(result[1]).toBe(1)
      expect(result[2]).toBe(2)
      expect(result[3]).toBe(3)
    })

    it('should handle single pixel', () => {
      const palette: Vector[] = [[128, 128, 128]]
      const rgbaBuffer = createRGBABuffer([[128, 128, 128, 255]])

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, false)

      expect(result.length).toBe(1)
      expect(result[0]).toBe(0)
    })

    it('should return Uint8Array of correct length', () => {
      const palette: Vector[] = [[0, 0, 0]]
      const rgbaBuffer = createRGBABuffer([
        [0, 0, 0, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255]
      ])

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, false)

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(5)
    })
  })

  describe('with quantization', () => {
    it('should quantize pixel values to CPC levels (0, 128, 255)', () => {
      // CPC quantization uses 3 levels: 0, 128, 255
      // 100 -> 128 (nearest), 150 -> 128 (nearest), 200 -> 255 (nearest)
      const palette: Vector[] = [
        [128, 128, 255] // quantized version
      ]

      const rgbaBuffer = createRGBABuffer([[100, 150, 200, 255]])

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, true)

      expect(result[0]).toBe(0)
    })

    it('should match quantized colors correctly', () => {
      // 128 quantizes to 128
      const palette: Vector[] = [[128, 128, 128]]

      const rgbaBuffer = createRGBABuffer([[100, 100, 100, 255]]) // All quantize to 128

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, true)

      expect(result[0]).toBe(0)
    })
  })

  describe('fallback to darkest color', () => {
    it('should use darkest color when pixel not found and fallback enabled', () => {
      const palette: Vector[] = [
        [255, 255, 255], // white (bright)
        [0, 0, 0], // black (darkest)
        [128, 128, 128] // gray
      ]

      // Color not in palette
      const rgbaBuffer = createRGBABuffer([[100, 100, 100, 255]])

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, false, true)

      // Should fallback to darkest (black at index 1)
      expect(result[0]).toBe(1)
    })

    it('should throw error when pixel not found and fallback disabled', () => {
      const palette: Vector[] = [[0, 0, 0]]

      const rgbaBuffer = createRGBABuffer([[255, 255, 255, 255]])

      expect(() => {
        rgbToIndexBufferExact(rgbaBuffer, palette, false, false)
      }).toThrow('Pixel RGB [255, 255, 255] non trouvé dans la palette.')
    })
  })

  describe('edge cases', () => {
    it('should handle empty buffer', () => {
      const palette: Vector[] = [[0, 0, 0]]
      const rgbaBuffer = new Uint8ClampedArray(0)

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, false)

      expect(result.length).toBe(0)
    })

    it('should ignore alpha channel for matching', () => {
      const palette: Vector[] = [[100, 100, 100]]

      // Different alpha values, same RGB
      const rgbaBuffer = createRGBABuffer([
        [100, 100, 100, 255],
        [100, 100, 100, 128],
        [100, 100, 100, 0]
      ])

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, false)

      expect(result[0]).toBe(0)
      expect(result[1]).toBe(0)
      expect(result[2]).toBe(0)
    })

    it('should handle palette with duplicate colors', () => {
      const palette: Vector[] = [
        [100, 100, 100],
        [100, 100, 100], // duplicate
        [200, 200, 200]
      ]

      const rgbaBuffer = createRGBABuffer([[100, 100, 100, 255]])

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, false)

      // Map implementation overwrites, so last occurrence wins
      // This is implementation-specific behavior
      expect(result[0]).toBe(1)
    })

    it('should handle CPC boundary values', () => {
      // CPC values: 0, 17, 34, 51, ..., 255
      const palette: Vector[] = [
        [0, 0, 0],
        [17, 17, 17],
        [255, 255, 255]
      ]

      const rgbaBuffer = createRGBABuffer([
        [0, 0, 0, 255],
        [17, 17, 17, 255],
        [255, 255, 255, 255]
      ])

      const result = rgbToIndexBufferExact(rgbaBuffer, palette, false)

      expect(result[0]).toBe(0)
      expect(result[1]).toBe(1)
      expect(result[2]).toBe(2)
    })
  })
})
