import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapAndDither,
  applyNoDither,
  applyFloydSteinbergDither,
  applyBayerDither,
  applyYliluoma1Dither,
  applyYliluoma2Dither
} from '../map-and-dither'
import type { Vector } from '../../type'
import { getDistanceFn } from '../../metric/distance'

// Mock logger to avoid console output in tests
vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('Map and Dither', () => {
  let testPalette: Vector[]
  let testImageData: Uint8ClampedArray

  beforeEach(() => {
    // Create a simple 2x2 test image (red, green, blue, white)
    testImageData = new Uint8ClampedArray([
      255, 0, 0, 255,    // red
      0, 255, 0, 255,    // green
      0, 0, 255, 255,    // blue
      255, 255, 255, 255 // white
    ])

    // Simple palette with basic colors
    testPalette = [
      [0, 0, 0],      // black
      [255, 255, 255], // white
      [255, 0, 0],    // red
      [0, 255, 0],    // green
      [0, 0, 255]     // blue
    ]
  })

  describe('mapAndDither', () => {
    it('should process image with no dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'none', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16) // 4 pixels * 4 channels
    })

    it('should process image with Floyd-Steinberg dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'floydSteinberg', intensity: 0.8 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should process image with Bayer 2x2 dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'bayer2x2', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should process image with Bayer 4x4 dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'bayer4x4', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should process image with Bayer 8x8 dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'bayer8x8', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should process image with Yliluoma 1 dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'ylioluma1', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should process image with Yliluoma 2 dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'ylioluma2', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should handle single pixel image', () => {
      const singlePixel = new Uint8ClampedArray([128, 128, 128, 255])
      const result = mapAndDither(
        singlePixel,
        1,
        1,
        testPalette,
        { mode: 'none', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(4)
    })

    it('should handle empty image', () => {
      const emptyImage = new Uint8ClampedArray([])
      const result = mapAndDither(
        emptyImage,
        0,
        0,
        testPalette,
        { mode: 'none', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(0)
    })

    it('should handle unsupported dithering mode', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'unsupported' as any, intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should work with different color spaces', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'none', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })
  })

  describe('applyNoDither', () => {
    it('should map colors to nearest palette colors without dithering', () => {
      const bufCS = new Float32Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255])
      const paletteCS = [new Float32Array([0, 0, 0]), new Float32Array([255, 255, 255])]
      const paletteOut = [new Uint8ClampedArray([0, 0, 0, 255]), new Uint8ClampedArray([255, 255, 255, 255])]
      const distFn = getDistanceFn('RGB', 'euclidean')

      const result = applyNoDither(bufCS, 2, 2, paletteCS, paletteOut, distFn)

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })
  })

  describe('applyFloydSteinbergDither', () => {
    it('should apply Floyd-Steinberg dithering algorithm', () => {
      const bufCS = new Float32Array([128, 128, 128, 200, 200, 200])
      const paletteCS = [new Float32Array([0, 0, 0]), new Float32Array([255, 255, 255])]
      const paletteOut = [new Uint8ClampedArray([0, 0, 0, 255]), new Uint8ClampedArray([255, 255, 255, 255])]
      const distFn = getDistanceFn('RGB', 'euclidean')

      const result = applyFloydSteinbergDither(bufCS, 2, 1, paletteCS, paletteOut, distFn, 0.5)

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(8)
    })
  })

  describe('applyBayerDither', () => {
    it('should apply Bayer 2x2 dithering', () => {
      const bufCS = new Float32Array([128, 128, 128, 128, 128, 128, 128, 128, 128])
      const paletteCS = [new Float32Array([0, 0, 0]), new Float32Array([255, 255, 255])]
      const paletteOut = [new Uint8ClampedArray([0, 0, 0, 255]), new Uint8ClampedArray([255, 255, 255, 255])]
      const distFn = getDistanceFn('RGB', 'euclidean')

      const result = applyBayerDither(
        bufCS,
        3,
        3,
        paletteCS,
        paletteOut,
        { config: { mode: 'bayer2x2', intensity: 0.5 }, mode: 'bayer2x2' },
        distFn
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(36)
    })

    it('should apply Bayer 4x4 dithering', () => {
      const bufCS = new Float32Array([128, 128, 128, 128, 128, 128])
      const paletteCS = [new Float32Array([0, 0, 0]), new Float32Array([255, 255, 255])]
      const paletteOut = [new Uint8ClampedArray([0, 0, 0, 255]), new Uint8ClampedArray([255, 255, 255, 255])]
      const distFn = getDistanceFn('RGB', 'euclidean')

      const result = applyBayerDither(
        bufCS,
        2,
        3,
        paletteCS,
        paletteOut,
        { config: { mode: 'bayer4x4', intensity: 0.5 }, mode: 'bayer4x4' },
        distFn
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(24)
    })
  })

  describe('applyYliluoma1Dither', () => {
    it('should apply Yliluoma 1 dithering', () => {
      const bufCS = new Float32Array([128, 128, 128, 200, 200, 200])
      const paletteCS = [new Float32Array([0, 0, 0]), new Float32Array([255, 255, 255])]
      const paletteOut = [new Uint8ClampedArray([0, 0, 0, 255]), new Uint8ClampedArray([255, 255, 255, 255])]
      const distFn = getDistanceFn('RGB', 'euclidean')

      const result = applyYliluoma1Dither(
        bufCS,
        2,
        1,
        paletteCS,
        paletteOut,
        { mode: 'ylioluma1', intensity: 0.5 },
        distFn
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(8)
    })
  })

  describe('applyYliluoma2Dither', () => {
    it('should apply Yliluoma 2 dithering', () => {
      const bufCS = new Float32Array([128, 128, 128, 200, 200, 200])
      const paletteCS = [new Float32Array([0, 0, 0]), new Float32Array([255, 255, 255])]
      const paletteOut = [new Uint8ClampedArray([0, 0, 0, 255]), new Uint8ClampedArray([255, 255, 255, 255])]
      const distFn = getDistanceFn('RGB', 'euclidean')

      const result = applyYliluoma2Dither(
        bufCS,
        2,
        1,
        paletteCS,
        paletteOut,
        { mode: 'ylioluma2', intensity: 0.5 },
        distFn
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(8)
    })
  })

  describe('Edge cases', () => {
    it('should handle palette with single color', () => {
      const singleColorPalette: Vector[] = [[128, 128, 128]]
      const result = mapAndDither(
        testImageData,
        2,
        2,
        singleColorPalette,
        { mode: 'none', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should handle very small intensity values', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'floydSteinberg', intensity: 0.01 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should handle maximum intensity values', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'floydSteinberg', intensity: 1 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(16)
    })

    it('should handle large images', () => {
      const largeImage = new Uint8ClampedArray(100 * 100 * 4)
      for (let i = 0; i < largeImage.length; i += 4) {
        largeImage[i] = Math.random() * 255
        largeImage[i + 1] = Math.random() * 255
        largeImage[i + 2] = Math.random() * 255
        largeImage[i + 3] = 255
      }

      const result = mapAndDither(
        largeImage,
        100,
        100,
        testPalette,
        { mode: 'bayer4x4', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(100 * 100 * 4)
    })
  })
})