import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  extractGlobalPaletteFromImage,
  optimizeLinePalettesWithIndexBuffer,
  quantizeToCPCPlus
} from './line-palette-optimizer'
import { posterizeImage, preprocessImageForRaster } from './preprocess-raster'
import { rasterTuningOverrides } from './raster-tuning'

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
    expect(palette).toHaveLength(1)
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
    expect(palette).toHaveLength(1)
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

    expect(palette).toHaveLength(4)
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

describe('extractGlobalPaletteFromImage with tuning params', () => {
  let originalPreprocessContinuityDistance: number
  let originalPreprocessContinuityBonus: number
  let originalPreprocessFrequencyExponent: number

  beforeEach(() => {
    // Save original values
    originalPreprocessContinuityDistance =
      rasterTuningOverrides.preprocessContinuityDistance
    originalPreprocessContinuityBonus =
      rasterTuningOverrides.preprocessContinuityBonus
    originalPreprocessFrequencyExponent =
      rasterTuningOverrides.preprocessFrequencyExponent
  })

  afterEach(() => {
    // Restore original values
    rasterTuningOverrides.preprocessContinuityDistance =
      originalPreprocessContinuityDistance
    rasterTuningOverrides.preprocessContinuityBonus =
      originalPreprocessContinuityBonus
    rasterTuningOverrides.preprocessFrequencyExponent =
      originalPreprocessFrequencyExponent
  })

  it('should use selectPaletteFarthestPoint when more colors than maxColors', () => {
    // Create an image with many unique colors (more than 4)
    const pixels: Array<{ x: number; y: number; color: Vector<'RGB'> }> = []
    const colors: Vector<'RGB'>[] = [
      [255, 0, 0], // Red
      [0, 255, 0], // Green
      [0, 0, 255], // Blue
      [255, 255, 0], // Yellow
      [255, 0, 255], // Magenta
      [0, 255, 255], // Cyan
      [128, 128, 128], // Gray
      [255, 128, 0] // Orange
    ]

    // Create 8x8 image with each color in different rows
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        pixels.push({ x, y, color: colors[y] })
      }
    }

    const image = createTestImage(8, 8, pixels)

    // Request only 4 colors - should trigger farthest point selection
    const palette = extractGlobalPaletteFromImage(image, 4)

    expect(palette).toHaveLength(4)
  })

  it('should respect frequencyExponent parameter', () => {
    // Create an image with colors of varying frequency
    const pixels: Array<{ x: number; y: number; color: Vector<'RGB'> }> = []

    // High frequency color (most of the image)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        pixels.push({ x, y, color: [255, 0, 0] }) // Red - 48 pixels
      }
    }
    // Low frequency colors
    for (let y = 0; y < 8; y++) {
      pixels.push({ x: 6, y, color: [0, 255, 0] }) // Green - 8 pixels
      pixels.push({ x: 7, y, color: [0, 0, 255] }) // Blue - 8 pixels
    }

    const image = createTestImage(8, 8, pixels)

    // With high frequency exponent (1.0), should strongly prefer frequent colors
    rasterTuningOverrides.preprocessFrequencyExponent = 1.0
    const paletteHighFreq = extractGlobalPaletteFromImage(image, 2)

    // With low frequency exponent (0.0), should favor diversity
    rasterTuningOverrides.preprocessFrequencyExponent = 0.0
    const paletteLowFreq = extractGlobalPaletteFromImage(image, 2)

    // Both should have 2 colors
    expect(paletteHighFreq).toHaveLength(2)
    expect(paletteLowFreq).toHaveLength(2)

    // The first color (most frequent) should be red in high freq mode
    // Note: colors are quantized to CPC Plus, so [255, 0, 0] stays [255, 0, 0]
    expect(paletteHighFreq[0]).toEqual([255, 0, 0])
  })

  it('should allow overriding preprocessContinuityDistance', () => {
    rasterTuningOverrides.preprocessContinuityDistance = 500
    expect(rasterTuningOverrides.preprocessContinuityDistance).toBe(500)

    rasterTuningOverrides.preprocessContinuityDistance = 2000
    expect(rasterTuningOverrides.preprocessContinuityDistance).toBe(2000)
  })

  it('should allow overriding preprocessContinuityBonus', () => {
    rasterTuningOverrides.preprocessContinuityBonus = 1.0
    expect(rasterTuningOverrides.preprocessContinuityBonus).toBe(1.0)

    rasterTuningOverrides.preprocessContinuityBonus = 3.0
    expect(rasterTuningOverrides.preprocessContinuityBonus).toBe(3.0)
  })

  it('should allow overriding preprocessFrequencyExponent', () => {
    rasterTuningOverrides.preprocessFrequencyExponent = 0.0
    expect(rasterTuningOverrides.preprocessFrequencyExponent).toBe(0.0)

    rasterTuningOverrides.preprocessFrequencyExponent = 1.0
    expect(rasterTuningOverrides.preprocessFrequencyExponent).toBe(1.0)
  })
})

describe('preprocessImageForRaster', () => {
  it('should reduce colors per line to max nColors', () => {
    // Create image with many colors on each line
    const width = 8
    const height = 4
    const data = new Uint8ClampedArray(width * height * 4)

    // Fill with gradient to create many unique colors
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        data[idx] = x * 32 // R varies 0-224
        data[idx + 1] = y * 64 // G varies 0-192
        data[idx + 2] = (x + y) * 20 // B varies
        data[idx + 3] = 255
      }
    }
    const image = new ImageData(data, width, height)

    const result = preprocessImageForRaster(image, [], { nColors: 4 })

    // Check output dimensions match input
    expect(result.width).toBe(width)
    expect(result.height).toBe(height)

    // Verify each line has at most 4 unique colors
    for (let y = 0; y < height; y++) {
      const lineColors = new Set<string>()
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const key = `${result.data[idx]},${result.data[idx + 1]},${result.data[idx + 2]}`
        lineColors.add(key)
      }
      expect(lineColors.size).toBeLessThanOrEqual(4)
    }
  })

  it('should preserve image when already has ≤nColors per line and dithering disabled', () => {
    // Create image with exactly 2 colors per line
    const width = 4
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    // Line 0: alternating black and white (CPC Plus quantized values)
    const black: Vector<'RGB'> = [0, 0, 0]
    const white: Vector<'RGB'> = [255, 255, 255]

    for (let x = 0; x < width; x++) {
      const idx = x * 4
      const color = x % 2 === 0 ? black : white
      data[idx] = color[0]
      data[idx + 1] = color[1]
      data[idx + 2] = color[2]
      data[idx + 3] = 255
    }

    // Line 1: same pattern
    for (let x = 0; x < width; x++) {
      const idx = (width + x) * 4
      const color = x % 2 === 0 ? black : white
      data[idx] = color[0]
      data[idx + 1] = color[1]
      data[idx + 2] = color[2]
      data[idx + 3] = 255
    }

    const image = new ImageData(data, width, height)
    const result = preprocessImageForRaster(image, [], {
      nColors: 4,
      ditheringIntensity: 0
    })

    // Colors should be preserved (only black and white)
    for (let x = 0; x < width; x++) {
      const idx = x * 4
      const isBlack =
        result.data[idx] === 0 &&
        result.data[idx + 1] === 0 &&
        result.data[idx + 2] === 0
      const isWhite =
        result.data[idx] === 255 &&
        result.data[idx + 1] === 255 &&
        result.data[idx + 2] === 255
      expect(isBlack || isWhite).toBe(true)
    }
  })

  it('should apply dithering when ditheringIntensity > 0', () => {
    // Create gradient image
    const width = 8
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    for (let x = 0; x < width; x++) {
      const idx = x * 4
      data[idx] = x * 32 // R: 0, 32, 64, 96, 128, 160, 192, 224
      data[idx + 1] = x * 32
      data[idx + 2] = x * 32
      data[idx + 3] = 255
    }
    for (let x = 0; x < width; x++) {
      const idx = (width + x) * 4
      data[idx] = x * 32
      data[idx + 1] = x * 32
      data[idx + 2] = x * 32
      data[idx + 3] = 255
    }

    const image = new ImageData(data, width, height)
    const result = preprocessImageForRaster(image, [], {
      nColors: 4,
      ditheringIntensity: 0.75
    })

    // Output should have valid CPC Plus colors (multiples of 17)
    for (let i = 0; i < result.data.length; i += 4) {
      const r = result.data[i]
      const g = result.data[i + 1]
      const b = result.data[i + 2]
      expect(r % 17).toBe(0)
      expect(g % 17).toBe(0)
      expect(b % 17).toBe(0)
    }
  })

  it('should handle CPC Classic palette constraint', () => {
    const cpcClassicPalette: Vector<'RGB'>[] = [
      [0, 0, 0], // Black
      [0, 0, 128], // Blue
      [128, 0, 0], // Red
      [128, 0, 128], // Magenta
      [0, 128, 0], // Green
      [0, 128, 128], // Cyan
      [128, 128, 0], // Yellow
      [128, 128, 128], // White
      [0, 0, 255], // Bright blue
      [255, 0, 0], // Bright red
      [255, 0, 255], // Bright magenta
      [0, 255, 0], // Bright green
      [0, 255, 255], // Bright cyan
      [255, 255, 0], // Bright yellow
      [255, 255, 255] // Bright white
    ]

    const width = 4
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    // Fill with a color not in the palette
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100
      data[i + 1] = 50
      data[i + 2] = 150
      data[i + 3] = 255
    }

    const image = new ImageData(data, width, height)
    const result = preprocessImageForRaster(image, [], {
      nColors: 4,
      cpcClassicPalette
    })

    // Output colors should be from the CPC Classic palette
    for (let i = 0; i < result.data.length; i += 4) {
      const color: Vector<'RGB'> = [
        result.data[i],
        result.data[i + 1],
        result.data[i + 2]
      ]
      const isInPalette = cpcClassicPalette.some(
        (pc) => pc[0] === color[0] && pc[1] === color[1] && pc[2] === color[2]
      )
      expect(isInPalette).toBe(true)
    }
  })

  it('should handle Mode 2 with 2 colors', () => {
    const width = 4
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    // Create gradient
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width
      data[i] = x * 80
      data[i + 1] = x * 80
      data[i + 2] = x * 80
      data[i + 3] = 255
    }

    const image = new ImageData(data, width, height)
    const result = preprocessImageForRaster(image, [], { nColors: 2 })

    // Each line should have at most 2 colors
    for (let y = 0; y < height; y++) {
      const lineColors = new Set<string>()
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const key = `${result.data[idx]},${result.data[idx + 1]},${result.data[idx + 2]}`
        lineColors.add(key)
      }
      expect(lineColors.size).toBeLessThanOrEqual(2)
    }
  })
})

describe('optimizeLinePalettesWithIndexBuffer', () => {
  it('should return changes and index buffer', () => {
    // Create simple 4-color image
    const width = 4
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    // Line 0: 4 different CPC Plus colors
    const colors: Vector<'RGB'>[] = [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ]
    for (let x = 0; x < width; x++) {
      const idx = x * 4
      data[idx] = colors[x][0]
      data[idx + 1] = colors[x][1]
      data[idx + 2] = colors[x][2]
      data[idx + 3] = 255
    }

    // Line 1: same colors
    for (let x = 0; x < width; x++) {
      const idx = (width + x) * 4
      data[idx] = colors[x][0]
      data[idx + 1] = colors[x][1]
      data[idx + 2] = colors[x][2]
      data[idx + 3] = 255
    }

    const image = new ImageData(data, width, height)
    const globalPalette: Vector<'RGB'>[] = [...colors]

    const result = optimizeLinePalettesWithIndexBuffer(image, globalPalette)

    expect(result).toHaveProperty('changes')
    expect(result).toHaveProperty('indexBuffer')
    expect(result).toHaveProperty('quantizedGlobalPalette')
    expect(result.indexBuffer).toHaveLength(width * height)
  })

  it('should generate correct index buffer for single-color image', () => {
    const width = 4
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    // Fill with single color (CPC Plus quantized)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 // R
      data[i + 1] = 0 // G
      data[i + 2] = 0 // B
      data[i + 3] = 255 // A
    }

    const image = new ImageData(data, width, height)
    const globalPalette: Vector<'RGB'>[] = [[255, 0, 0]]

    const result = optimizeLinePalettesWithIndexBuffer(image, globalPalette)

    // All pixels should map to the same ink index
    const firstIndex = result.indexBuffer[0]
    for (let i = 1; i < result.indexBuffer.length; i++) {
      expect(result.indexBuffer[i]).toBe(firstIndex)
    }
  })

  it('should respect maxChangesPerLine option', () => {
    // Create preprocessed image with exactly 4 colors per line (CPC Plus quantized)
    const width = 8
    const height = 4
    const data = new Uint8ClampedArray(width * height * 4)

    // Each line uses the same 4 CPC Plus colors
    const lineColors: Vector<'RGB'>[] = [
      [0, 0, 0], // Black
      [255, 0, 0], // Red
      [0, 255, 0], // Green
      [0, 0, 255] // Blue
    ]

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const color = lineColors[x % 4]
        data[idx] = color[0]
        data[idx + 1] = color[1]
        data[idx + 2] = color[2]
        data[idx + 3] = 255
      }
    }

    const image = new ImageData(data, width, height)
    const globalPalette: Vector<'RGB'>[] = [...lineColors]

    // Test with maxChangesPerLine = 1
    const result = optimizeLinePalettesWithIndexBuffer(
      image,
      globalPalette,
      [],
      {
        maxChangesPerLine: 1
      }
    )

    // Count changes per line
    const changesPerLine = new Map<number, number>()
    for (const change of result.changes) {
      const count = changesPerLine.get(change.line) || 0
      changesPerLine.set(change.line, count + 1)
    }

    // Each line should have at most 1 change
    for (const count of changesPerLine.values()) {
      expect(count).toBeLessThanOrEqual(1)
    }
  })

  it('should handle existing changes', () => {
    const width = 4
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128
      data[i + 1] = 128
      data[i + 2] = 128
      data[i + 3] = 255
    }

    const image = new ImageData(data, width, height)
    const globalPalette: Vector<'RGB'>[] = [[128, 128, 128]]

    const existingChanges = [
      { line: 0, inkIndex: 0, color: [255, 0, 0] as Vector<'RGB'> }
    ]

    const result = optimizeLinePalettesWithIndexBuffer(
      image,
      globalPalette,
      existingChanges
    )

    // Existing change should be preserved
    expect(result.changes).toContainEqual(existingChanges[0])
  })

  it('should use provided palette when useProvidedPalette is true', () => {
    const width = 4
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100
      data[i + 1] = 100
      data[i + 2] = 100
      data[i + 3] = 255
    }

    const image = new ImageData(data, width, height)
    const providedPalette: Vector<'RGB'>[] = [
      [0, 0, 0],
      [85, 85, 85],
      [170, 170, 170],
      [255, 255, 255]
    ]

    const result = optimizeLinePalettesWithIndexBuffer(
      image,
      providedPalette,
      [],
      { useProvidedPalette: true }
    )

    // The quantized global palette should be based on provided palette (quantized to CPC Plus)
    expect(result.quantizedGlobalPalette.length).toBeGreaterThanOrEqual(4)
  })

  it('should handle Mode 0 CPC Plus (16 colors)', () => {
    const width = 8
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)

    // Create image with multiple colors
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width
      data[i] = x * 30
      data[i + 1] = x * 20
      data[i + 2] = x * 25
      data[i + 3] = 255
    }

    const image = new ImageData(data, width, height)
    const globalPalette: Vector<'RGB'>[] = Array(16)
      .fill(null)
      .map((_, i) => [i * 16, i * 16, i * 16] as Vector<'RGB'>)

    const result = optimizeLinePalettesWithIndexBuffer(
      image,
      globalPalette,
      [],
      {
        nColors: 16,
        maxChangesPerLine: 4
      }
    )

    // Index buffer should use indices 0-15
    for (const idx of result.indexBuffer) {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(16)
    }
  })
})
