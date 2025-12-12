import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  extractGlobalPaletteFromImage,
  posterizeImage,
  quantizeToCPCPlus,
  rasterTuningOverrides
} from './optimize-line-palettes'
import { MODE_0_LINE_WEIGHT, MODE_0_PIXEL_WEIGHT } from './raster-constants'

/**
 * Create a simple ImageData with specified colors at given positions
 */
function createTestImage(
  width: number,
  height: number,
  pixels: Array<{ x: number; y: number; color: Vector<'RGB'> }>
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  // Fill with black by default
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0 // R
    data[i + 1] = 0 // G
    data[i + 2] = 0 // B
    data[i + 3] = 255 // A
  }

  // Set specified pixels
  for (const { x, y, color } of pixels) {
    const idx = (y * width + x) * 4
    data[idx] = color[0]
    data[idx + 1] = color[1]
    data[idx + 2] = color[2]
    data[idx + 3] = 255
  }

  return new ImageData(data, width, height)
}

/**
 * Create an image filled with a single color
 */
function createSolidImage(
  width: number,
  height: number,
  color: Vector<'RGB'>
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0]
    data[i + 1] = color[1]
    data[i + 2] = color[2]
    data[i + 3] = 255
  }
  return new ImageData(data, width, height)
}

/**
 * Create an image with horizontal stripes
 */
function createStripedImage(
  width: number,
  height: number,
  colors: Vector<'RGB'>[]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const color = colors[y % colors.length]
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      data[idx] = color[0]
      data[idx + 1] = color[1]
      data[idx + 2] = color[2]
      data[idx + 3] = 255
    }
  }
  return new ImageData(data, width, height)
}

describe('quantizeToCPCPlus', () => {
  it('should quantize colors to 4-bit CPC Plus format (16 levels)', () => {
    // CPC Plus has 16 levels per channel: 0, 17, 34, ..., 255
    expect(quantizeToCPCPlus([0, 0, 0])).toEqual([0, 0, 0])
    expect(quantizeToCPCPlus([17, 17, 17])).toEqual([17, 17, 17])
    expect(quantizeToCPCPlus([255, 255, 255])).toEqual([255, 255, 255])
  })

  it('should round to nearest CPC Plus level', () => {
    // Values should round to nearest multiple of 17
    expect(quantizeToCPCPlus([8, 8, 8])).toEqual([0, 0, 0]) // 8 rounds to 0
    expect(quantizeToCPCPlus([9, 9, 9])).toEqual([17, 17, 17]) // 9 rounds to 17
    expect(quantizeToCPCPlus([25, 25, 25])).toEqual([17, 17, 17]) // 25 rounds to 17
    expect(quantizeToCPCPlus([26, 26, 26])).toEqual([34, 34, 34]) // 26 rounds to 34
  })

  it('should handle mixed channel values', () => {
    expect(quantizeToCPCPlus([255, 0, 128])).toEqual([255, 0, 136]) // 128/17 ≈ 7.5 → 8*17 = 136
    expect(quantizeToCPCPlus([100, 200, 50])).toEqual([102, 204, 51])
  })
})

describe('rasterTuningOverrides', () => {
  // Store original values
  let originalMode0PixelWeight: number
  let originalMode0LineWeight: number

  beforeEach(() => {
    // Save original values
    originalMode0PixelWeight = rasterTuningOverrides.mode0PixelWeight
    originalMode0LineWeight = rasterTuningOverrides.mode0LineWeight
  })

  afterEach(() => {
    // Restore original values
    rasterTuningOverrides.mode0PixelWeight = originalMode0PixelWeight
    rasterTuningOverrides.mode0LineWeight = originalMode0LineWeight
  })

  it('should have default values from constants', () => {
    expect(rasterTuningOverrides.mode0PixelWeight).toBe(MODE_0_PIXEL_WEIGHT)
    expect(rasterTuningOverrides.mode0LineWeight).toBe(MODE_0_LINE_WEIGHT)
  })

  it('should allow overriding mode0PixelWeight', () => {
    rasterTuningOverrides.mode0PixelWeight = 3
    expect(rasterTuningOverrides.mode0PixelWeight).toBe(3)
  })

  it('should allow overriding mode0LineWeight', () => {
    rasterTuningOverrides.mode0LineWeight = 5
    expect(rasterTuningOverrides.mode0LineWeight).toBe(5)
  })
})

describe('posterizeImage', () => {
  it('should reduce color levels', () => {
    // Create image with colors that will be posterized
    const image = createSolidImage(2, 2, [100, 150, 200])
    const posterized = posterizeImage(image, 8) // 8 levels = step of 32

    // 100/32 ≈ 3.125 → round to 3 → 3*32 = 96
    // 150/32 ≈ 4.6875 → round to 5 → 5*32 = 160
    // 200/32 = 6.25 → round to 6 → 6*32 = 192
    const expected = [96, 160, 192]
    expect(posterized.data[0]).toBe(expected[0])
    expect(posterized.data[1]).toBe(expected[1])
    expect(posterized.data[2]).toBe(expected[2])
  })

  it('should preserve alpha channel', () => {
    const image = createSolidImage(1, 1, [128, 128, 128])
    const posterized = posterizeImage(image, 8)
    expect(posterized.data[3]).toBe(255) // Alpha preserved
  })

  it('should snap colors near anchor palette colors', () => {
    // Create image with a color close to an anchor
    const image = createSolidImage(2, 2, [130, 130, 130]) // Close to [128, 128, 128]
    const anchor: Vector<'RGB'> = [128, 128, 128]
    const posterized = posterizeImage(image, 8, [anchor])

    // Should snap to anchor color, not posterize
    expect(posterized.data[0]).toBe(128)
    expect(posterized.data[1]).toBe(128)
    expect(posterized.data[2]).toBe(128)
  })

  it('should not snap colors far from anchor palette', () => {
    // Create image with a color far from anchor
    const image = createSolidImage(2, 2, [50, 50, 50])
    const anchor: Vector<'RGB'> = [200, 200, 200] // Far from [50, 50, 50]
    const posterized = posterizeImage(image, 8, [anchor])

    // Should posterize normally, not snap to anchor
    // 50/32 ≈ 1.5625 → round to 2 → 2*32 = 64
    expect(posterized.data[0]).toBe(64)
    expect(posterized.data[1]).toBe(64)
    expect(posterized.data[2]).toBe(64)
  })

  it('should preserve image dimensions', () => {
    const image = createSolidImage(10, 20, [100, 100, 100])
    const posterized = posterizeImage(image, 8)
    expect(posterized.width).toBe(10)
    expect(posterized.height).toBe(20)
  })
})

describe('extractGlobalPaletteFromImage', () => {
  it('should extract colors from image', () => {
    const red: Vector<'RGB'> = [255, 0, 0]
    const green: Vector<'RGB'> = [0, 255, 0]
    const image = createStripedImage(4, 4, [red, green])

    const palette = extractGlobalPaletteFromImage(image, 4)

    expect(palette.length).toBeLessThanOrEqual(4)
    expect(palette.length).toBeGreaterThan(0)
  })

  it('should return fewer colors if image has few unique colors', () => {
    const black: Vector<'RGB'> = [0, 0, 0]
    const image = createSolidImage(10, 10, black)

    const palette = extractGlobalPaletteFromImage(image, 16)

    // Should only have 1 color since image is solid
    expect(palette.length).toBe(1)
    expect(palette[0]).toEqual([0, 0, 0])
  })

  it('should quantize to CPC Plus levels', () => {
    // Create image with a color that needs quantization
    const color: Vector<'RGB'> = [100, 150, 200]
    const image = createSolidImage(2, 2, color)

    const palette = extractGlobalPaletteFromImage(image, 4)

    // 100/17 ≈ 5.9 → 6*17 = 102
    // 150/17 ≈ 8.8 → 9*17 = 153
    // 200/17 ≈ 11.8 → 12*17 = 204
    expect(palette.length).toBe(1)
    expect(palette[0]).toEqual([102, 153, 204])
  })

  it('should handle image with multiple colors', () => {
    // Create an image with distinct colors
    const pixels: Array<{ x: number; y: number; color: Vector<'RGB'> }> = []
    const colors: Vector<'RGB'>[] = [
      [255, 0, 0], // Red
      [0, 255, 0], // Green
      [0, 0, 255], // Blue
      [255, 255, 0] // Yellow
    ]

    // Create 4x4 image with each color in a quadrant
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const colorIdx = (y < 2 ? 0 : 2) + (x < 2 ? 0 : 1)
        pixels.push({ x, y, color: colors[colorIdx] })
      }
    }

    const image = createTestImage(4, 4, pixels)
    const palette = extractGlobalPaletteFromImage(image, 4)

    expect(palette.length).toBe(4)
  })
})

describe('Mode 0 CPC Plus weight tuning', () => {
  let originalMode0PixelWeight: number
  let originalMode0LineWeight: number

  beforeEach(() => {
    originalMode0PixelWeight = rasterTuningOverrides.mode0PixelWeight
    originalMode0LineWeight = rasterTuningOverrides.mode0LineWeight
  })

  afterEach(() => {
    rasterTuningOverrides.mode0PixelWeight = originalMode0PixelWeight
    rasterTuningOverrides.mode0LineWeight = originalMode0LineWeight
  })

  it('should allow setting pixel weight to 0', () => {
    rasterTuningOverrides.mode0PixelWeight = 0
    expect(rasterTuningOverrides.mode0PixelWeight).toBe(0)
  })

  it('should allow setting line weight to 0', () => {
    rasterTuningOverrides.mode0LineWeight = 0
    expect(rasterTuningOverrides.mode0LineWeight).toBe(0)
  })

  it('should support high weight values', () => {
    rasterTuningOverrides.mode0PixelWeight = 5
    rasterTuningOverrides.mode0LineWeight = 5
    expect(rasterTuningOverrides.mode0PixelWeight).toBe(5)
    expect(rasterTuningOverrides.mode0LineWeight).toBe(5)
  })

  it('should support decimal weight values', () => {
    rasterTuningOverrides.mode0PixelWeight = 1.5
    rasterTuningOverrides.mode0LineWeight = 2.5
    expect(rasterTuningOverrides.mode0PixelWeight).toBe(1.5)
    expect(rasterTuningOverrides.mode0LineWeight).toBe(2.5)
  })
})

describe('rasterTuningOverrides - other coefficients', () => {
  it('should have verticalErrorCoefficient defined', () => {
    expect(rasterTuningOverrides.verticalErrorCoefficient).toBeDefined()
    expect(typeof rasterTuningOverrides.verticalErrorCoefficient).toBe('number')
  })

  it('should have horizontalErrorCoefficient defined', () => {
    expect(rasterTuningOverrides.horizontalErrorCoefficient).toBeDefined()
    expect(typeof rasterTuningOverrides.horizontalErrorCoefficient).toBe(
      'number'
    )
  })

  it('should have preprocessContinuityDistance defined', () => {
    expect(rasterTuningOverrides.preprocessContinuityDistance).toBeDefined()
    expect(typeof rasterTuningOverrides.preprocessContinuityDistance).toBe(
      'number'
    )
  })

  it('should have preprocessContinuityBonus defined', () => {
    expect(rasterTuningOverrides.preprocessContinuityBonus).toBeDefined()
    expect(typeof rasterTuningOverrides.preprocessContinuityBonus).toBe(
      'number'
    )
  })

  it('should have preprocessFrequencyExponent defined', () => {
    expect(rasterTuningOverrides.preprocessFrequencyExponent).toBeDefined()
    expect(typeof rasterTuningOverrides.preprocessFrequencyExponent).toBe(
      'number'
    )
  })
})
