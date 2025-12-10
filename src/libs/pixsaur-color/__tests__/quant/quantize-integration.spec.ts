import { describe, expect, it } from 'vitest'
import { createQuantizer } from '../../src/quant/quantize'
import type { Vector } from '../../src/type'

describe('quantize.ts - Integration Tests', () => {
  describe('createQuantizer with real dependencies', () => {
    it('should reduce palette using frequency-based selection', () => {
      // Create an image buffer with mostly red pixels
      const buffer = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
        255,
        0,
        0,
        255, // red
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
        255 // blue
      ])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0], // red
        [0, 255, 0], // green
        [0, 0, 255], // blue
        [255, 255, 0], // yellow
        [255, 0, 255] // magenta
      ]

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const result = quantizer.quantize(3)

      expect(result).toHaveLength(3)
      // Red should be first (most frequent)
      expect(result[0]).toEqual([255, 0, 0])
    })

    it('should respect preselected colors', () => {
      const buffer = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
        255,
        0,
        0,
        255 // red
      ])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0], // red
        [0, 255, 0], // green
        [0, 0, 255] // blue
      ]

      const preselected: Vector<'RGB'>[] = [[0, 0, 255]] // force blue

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected,
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const result = quantizer.quantize(2)

      expect(result).toHaveLength(2)
      // Blue should be included (preselected)
      expect(result).toContainEqual([0, 0, 255])
    })

    it('should use diversity mode for medium palettes (8-16 colors)', () => {
      // Create a buffer with various colors
      const buffer = new Uint8ClampedArray(
        Array(16)
          .fill(0)
          .flatMap((_, i) => [i * 16, i * 16, i * 16, 255])
      )

      const basePalette: Vector<'RGB'>[] = Array(27)
        .fill(0)
        .map((_, i) => [i * 9, i * 9, i * 9])

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const result = quantizer.quantize(16)

      // May return less than 16 if not enough distinct colors in image
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBeLessThanOrEqual(16)
    })

    it('should apply palette strategy v2 when specified', () => {
      const buffer = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
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
        255 // blue
      ])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0], // red
        [0, 255, 0], // green
        [0, 0, 255], // blue
        [255, 255, 255], // white
        [0, 0, 0] // black
      ]

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: {
          distanceMetric: 'euclidean',
          paletteStrategy: 'frequency-balanced'
        }
      })

      const result = quantizer.quantize(3)

      expect(result).toHaveLength(3)
      // Should include most frequent colors
      expect(result).toContainEqual([255, 0, 0])
    })

    it('should convert legacy contrastStrategy to v2 strategy', () => {
      const buffer = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
        0,
        255,
        0,
        255 // green
      ])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0], // red
        [0, 255, 0], // green
        [0, 0, 255], // blue
        [255, 255, 255] // white
      ]

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: {
          distanceMetric: 'euclidean',
          contrastStrategy: 'balanced'
        }
      })

      const result = quantizer.quantize(2)

      expect(result).toHaveLength(2)
    })

    it('should use max contrast strategy for legacy max mode', () => {
      const buffer = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
        0,
        255,
        0,
        255 // green
      ])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0], // red
        [0, 255, 0], // green
        [0, 0, 255], // blue
        [255, 255, 255] // white
      ]

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: {
          distanceMetric: 'euclidean',
          contrastStrategy: 'max'
        }
      })

      const result = quantizer.quantize(2)

      expect(result).toHaveLength(2)
    })

    it('should fall back to frequency when no strategy specified', () => {
      const buffer = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
        255,
        0,
        0,
        255, // red
        0,
        255,
        0,
        255 // green
      ])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0], // red
        [0, 255, 0], // green
        [0, 0, 255] // blue
      ]

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const result = quantizer.quantize(2)

      expect(result).toHaveLength(2)
      // Should include most frequent colors
      expect(result[0]).toEqual([255, 0, 0])
    })

    it('should handle palette limits larger than 16 without strategy', () => {
      const buffer = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
        0,
        255,
        0,
        255 // green
      ])

      const basePalette: Vector<'RGB'>[] = Array(27)
        .fill(0)
        .map((_, i) => [i * 9, i * 9, i * 9])

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: {
          distanceMetric: 'euclidean',
          paletteStrategy: 'frequency-balanced'
        }
      })

      const result = quantizer.quantize(20)

      expect(result.length).toBeLessThanOrEqual(20)
    })

    it('should calculate relative threshold based on image size', () => {
      // Large image should use higher threshold
      const largeBuffer = new Uint8ClampedArray(
        Array(10000)
          .fill(0)
          .flatMap((i) => [i % 256, i % 128, i % 64, 255]) // Add color variation
      )

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [128, 128, 128],
        [255, 255, 255]
      ]

      const quantizer = createQuantizer({
        buf: largeBuffer,
        basePalette,
        preselected: [],
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const result = quantizer.quantize(2)

      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBeLessThanOrEqual(2)
    })

    it('should handle empty preselected array', () => {
      const buffer = new Uint8ClampedArray([255, 0, 0, 255])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0]
      ]

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const result = quantizer.quantize(1)

      expect(result).toHaveLength(1)
    })

    it('should handle preselected colors not in base palette', () => {
      const buffer = new Uint8ClampedArray([255, 0, 0, 255])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0]
      ]

      const preselected: Vector<'RGB'>[] = [[128, 128, 128]] // not in palette

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected,
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const result = quantizer.quantize(1)

      // Should still work, ignoring invalid preselected color
      expect(result).toHaveLength(1)
    })
  })

  describe('dither method integration', () => {
    it('should dither image data with Floyd-Steinberg', () => {
      const buffer = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255])

      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0]
      ]

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const imageData = new ImageData(
        new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]),
        2,
        1
      )

      const reducedPalette: Vector[] = [
        [255, 0, 0],
        [0, 255, 0]
      ]

      const result = quantizer.dither(imageData, reducedPalette, {
        mode: 'floydSteinberg',
        intensity: 1.0
      })

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result.length).toBe(8) // 2 pixels * 4 channels
    })

    it('should handle no dithering mode', () => {
      const buffer = new Uint8ClampedArray([255, 0, 0, 255])

      const basePalette: Vector<'RGB'>[] = [[255, 0, 0]]

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected: [],
        quantConfig: { distanceMetric: 'euclidean' }
      })

      const imageData = new ImageData(
        new Uint8ClampedArray([255, 0, 0, 255]),
        1,
        1
      )

      const reducedPalette: Vector[] = [[255, 0, 0]]

      const result = quantizer.dither(imageData, reducedPalette, {
        mode: 'none',
        intensity: 0
      })

      expect(result).toBeInstanceOf(Uint8ClampedArray)
    })
  })
})
