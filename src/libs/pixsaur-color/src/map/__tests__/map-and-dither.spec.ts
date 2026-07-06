import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDistanceFn } from '../../metric/distance'
import type { Vector } from '../../type'
import {
  applyBayerDither,
  applyFloydSteinbergDither,
  applyNoDither,
  applyYliluoma1Dither,
  applyYliluoma2Dither,
  mapAndDither,
  mapAndDitherWithDynamicPalette
} from '../map-and-dither'

// Mock logger to avoid console output in tests
vi.mock('@/core', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...(actual as any),
    logger: {
      ...(actual.logger || {}),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    }
  }
})

describe('Map and Dither', () => {
  let testPalette: Vector[]
  let testImageData: Uint8ClampedArray

  beforeEach(() => {
    // Create a simple 2x2 test image (red, green, blue, white)
    testImageData = new Uint8ClampedArray([
      255,
      0,
      0,
      255, // red
      0,
      255,
      0,
      255, // green
      0,
      0,
      255,
      255, // blue
      255,
      255,
      255,
      255 // white
    ])

    // Simple palette with basic colors
    testPalette = [
      [0, 0, 0], // black
      [255, 255, 255], // white
      [255, 0, 0], // red
      [0, 255, 0], // green
      [0, 0, 255] // blue
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
      expect(result).toHaveLength(16) // 4 pixels * 4 channels
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(4)
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
      expect(result).toHaveLength(0)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(16)
    })
  })

  describe('applyNoDither', () => {
    it('should map colors to nearest palette colors without dithering', () => {
      const bufCS = new Float32Array([
        255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255
      ])
      const paletteCS = [
        new Float32Array([0, 0, 0]),
        new Float32Array([255, 255, 255])
      ]
      const paletteOut = [
        new Uint8ClampedArray([0, 0, 0, 255]),
        new Uint8ClampedArray([255, 255, 255, 255])
      ]
      const distFn = getDistanceFn('RGB', 'euclidean')

      const result = applyNoDither(bufCS, 2, 2, paletteCS, paletteOut, distFn)

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })
  })

  describe('applyFloydSteinbergDither', () => {
    it('should apply Floyd-Steinberg dithering algorithm', () => {
      const bufCS = new Float32Array([128, 128, 128, 200, 200, 200])
      const paletteCS = [
        new Float32Array([0, 0, 0]),
        new Float32Array([255, 255, 255])
      ]
      const paletteOut = [
        new Uint8ClampedArray([0, 0, 0, 255]),
        new Uint8ClampedArray([255, 255, 255, 255])
      ]
      const distFn = getDistanceFn('RGB', 'euclidean')

      const result = applyFloydSteinbergDither({
        bufCS,
        width: 2,
        height: 1,
        paletteCS,
        paletteOut,
        distFn,
        intensity: 0.5,
        correction: { enabled: true, errorClamp: 64 }
      })

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(8)
    })
  })

  describe('applyBayerDither', () => {
    it('should apply Bayer 2x2 dithering', () => {
      const bufCS = new Float32Array([
        128, 128, 128, 128, 128, 128, 128, 128, 128
      ])
      const paletteCS = [
        new Float32Array([0, 0, 0]),
        new Float32Array([255, 255, 255])
      ]
      const paletteOut = [
        new Uint8ClampedArray([0, 0, 0, 255]),
        new Uint8ClampedArray([255, 255, 255, 255])
      ]
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
      expect(result).toHaveLength(36)
    })

    it('should apply Bayer 4x4 dithering', () => {
      const bufCS = new Float32Array([128, 128, 128, 128, 128, 128])
      const paletteCS = [
        new Float32Array([0, 0, 0]),
        new Float32Array([255, 255, 255])
      ]
      const paletteOut = [
        new Uint8ClampedArray([0, 0, 0, 255]),
        new Uint8ClampedArray([255, 255, 255, 255])
      ]
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
      expect(result).toHaveLength(24)
    })
  })

  describe('applyYliluoma1Dither', () => {
    it('should apply Yliluoma 1 dithering', () => {
      const bufCS = new Float32Array([128, 128, 128, 200, 200, 200])
      const paletteCS = [
        new Float32Array([0, 0, 0]),
        new Float32Array([255, 255, 255])
      ]
      const paletteOut = [
        new Uint8ClampedArray([0, 0, 0, 255]),
        new Uint8ClampedArray([255, 255, 255, 255])
      ]
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
      expect(result).toHaveLength(8)
    })
  })

  describe('applyYliluoma2Dither', () => {
    it('should apply Yliluoma 2 dithering', () => {
      const bufCS = new Float32Array([128, 128, 128, 200, 200, 200])
      const paletteCS = [
        new Float32Array([0, 0, 0]),
        new Float32Array([255, 255, 255])
      ]
      const paletteOut = [
        new Uint8ClampedArray([0, 0, 0, 255]),
        new Uint8ClampedArray([255, 255, 255, 255])
      ]
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
      expect(result).toHaveLength(8)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(16)
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
      expect(result).toHaveLength(100 * 100 * 4)
    })
  })

  describe('Additional dithering modes', () => {
    it('should process image with Atkinson dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'atkinson', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })

    it('should process image with Halftone 4x4 dithering', () => {
      const result = mapAndDither(
        testImageData,
        2,
        2,
        testPalette,
        { mode: 'halftone4x4', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })

    it('should apply halftone pattern correctly', () => {
      // Create grayscale gradient for better halftone visualization
      const gradientImage = new Uint8ClampedArray(4 * 4 * 4)
      for (let i = 0; i < 16; i++) {
        const v = (i * 16) % 256
        const idx = i * 4
        gradientImage[idx] = v
        gradientImage[idx + 1] = v
        gradientImage[idx + 2] = v
        gradientImage[idx + 3] = 255
      }

      const result = mapAndDither(
        gradientImage,
        4,
        4,
        testPalette,
        { mode: 'halftone4x4', intensity: 0.8 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(64)
    })
  })

  describe('mapAndDitherWithDynamicPalette', () => {
    it('should apply no dithering with dynamic palette', () => {
      const getPaletteForLine = (_y: number): Vector[] => {
        return [
          [0, 0, 0],
          [255, 255, 255]
        ]
      }

      const result = mapAndDitherWithDynamicPalette(
        testImageData,
        2,
        2,
        getPaletteForLine,
        { mode: 'none', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })

    it('should apply Bayer 2x2 with dynamic palette', () => {
      const getPaletteForLine = (_y: number): Vector[] => {
        return [
          [0, 0, 0],
          [255, 255, 255]
        ]
      }

      const result = mapAndDitherWithDynamicPalette(
        testImageData,
        2,
        2,
        getPaletteForLine,
        { mode: 'bayer2x2', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })

    it('should apply Bayer 4x4 with dynamic palette', () => {
      const getPaletteForLine = (_y: number): Vector[] => {
        return [
          [0, 0, 0],
          [255, 0, 0],
          [0, 255, 0],
          [0, 0, 255]
        ]
      }

      const result = mapAndDitherWithDynamicPalette(
        testImageData,
        2,
        2,
        getPaletteForLine,
        { mode: 'bayer4x4', intensity: 0.7 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })

    it('should apply Bayer 8x8 with dynamic palette', () => {
      const getPaletteForLine = (y: number): Vector[] => {
        // Different palette per line
        if (y === 0) {
          return [
            [0, 0, 0],
            [255, 0, 0]
          ]
        }
        return [
          [0, 0, 0],
          [0, 255, 0]
        ]
      }

      const result = mapAndDitherWithDynamicPalette(
        testImageData,
        2,
        2,
        getPaletteForLine,
        { mode: 'bayer8x8', intensity: 0.6 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })

    it('should apply halftone with dynamic palette', () => {
      const getPaletteForLine = (_y: number): Vector[] => testPalette

      const result = mapAndDitherWithDynamicPalette(
        testImageData,
        2,
        2,
        getPaletteForLine,
        { mode: 'halftone4x4', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })

    it('should fallback to no dithering for unsupported modes', () => {
      const getPaletteForLine = (_y: number): Vector[] => testPalette

      // floydSteinberg is not supported with dynamic palettes
      const result = mapAndDitherWithDynamicPalette(
        testImageData,
        2,
        2,
        getPaletteForLine,
        { mode: 'floydSteinberg', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
    })

    it('should handle different palettes per line', () => {
      // 4x2 image - each line gets different palette
      const imageData = new Uint8ClampedArray(4 * 2 * 4)
      for (let i = 0; i < imageData.length; i += 4) {
        imageData[i] = 128
        imageData[i + 1] = 128
        imageData[i + 2] = 128
        imageData[i + 3] = 255
      }

      const getPaletteForLine = (y: number): Vector[] => {
        if (y === 0) {
          return [
            [0, 0, 0],
            [255, 0, 0]
          ] // Line 0: black/red
        }
        return [
          [0, 0, 0],
          [0, 0, 255]
        ] // Line 1: black/blue
      }

      const result = mapAndDitherWithDynamicPalette(
        imageData,
        4,
        2,
        getPaletteForLine,
        { mode: 'none', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(32)

      // Line 0 pixels should be mapped to either black or red
      for (let x = 0; x < 4; x++) {
        const idx = x * 4
        const isBlack =
          result[idx] === 0 && result[idx + 1] === 0 && result[idx + 2] === 0
        const isRed =
          result[idx] === 255 && result[idx + 1] === 0 && result[idx + 2] === 0
        expect(isBlack || isRed).toBe(true)
      }

      // Line 1 pixels should be mapped to either black or blue
      for (let x = 0; x < 4; x++) {
        const idx = (4 + x) * 4
        const isBlack =
          result[idx] === 0 && result[idx + 1] === 0 && result[idx + 2] === 0
        const isBlue =
          result[idx] === 0 && result[idx + 1] === 0 && result[idx + 2] === 255
        expect(isBlack || isBlue).toBe(true)
      }
    })

    it('should handle empty palette gracefully', () => {
      const getPaletteForLine = (_y: number): Vector[] => []

      const result = mapAndDitherWithDynamicPalette(
        testImageData,
        2,
        2,
        getPaletteForLine,
        { mode: 'none', intensity: 0.5 },
        'RGB'
      )

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toHaveLength(16)
      // Should fallback to black
      expect(result[0]).toBe(0)
      expect(result[1]).toBe(0)
      expect(result[2]).toBe(0)
    })
  })
})
