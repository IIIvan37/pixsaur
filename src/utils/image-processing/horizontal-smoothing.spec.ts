import { describe, expect, it } from 'vitest'
import {
  applyHorizontalSmoothing,
  getPixelWidthForMode
} from './horizontal-smoothing'

describe('getPixelWidthForMode', () => {
  it('returns 4 for Mode 0 (160×200)', () => {
    expect(getPixelWidthForMode(0)).toBe(4)
  })

  it('returns 2 for Mode 1 (320×200)', () => {
    expect(getPixelWidthForMode(1)).toBe(2)
  })

  it('returns 1 for Mode 2 (640×200)', () => {
    expect(getPixelWidthForMode(2)).toBe(1)
  })
})

describe('applyHorizontalSmoothing', () => {
  it('returns unchanged image for pixelWidth = 1', () => {
    const imageData = new ImageData(4, 1)
    imageData.data.set([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255
    ])

    const result = applyHorizontalSmoothing(imageData, 1)

    expect(Array.from(result.data)).toEqual(Array.from(imageData.data))
  })

  it('averages 2 pixels horizontally for pixelWidth = 2', () => {
    const imageData = new ImageData(4, 1)
    // Red, Green, Blue, White
    imageData.data.set([
      255,
      0,
      0,
      255, // Red
      0,
      255,
      0,
      255, // Green
      0,
      0,
      255,
      255, // Blue
      255,
      255,
      255,
      255 // White
    ])

    const result = applyHorizontalSmoothing(imageData, 2)

    // Pixel 0: average of Red(255,0,0) and Green(0,255,0) → (128, 128, 0) after rounding
    expect(result.data[0]).toBe(128) // R: (255+0)/2 = 127.5 → 128
    expect(result.data[1]).toBe(128) // G: (0+255)/2 = 127.5 → 128
    expect(result.data[2]).toBe(0) // B: (0+0)/2 = 0

    // Verify dimensions unchanged
    expect(result.width).toBe(4)
    expect(result.height).toBe(1)
  })

  it('averages 4 pixels horizontally for pixelWidth = 4', () => {
    const imageData = new ImageData(4, 1)
    // Red, Green, Blue, White
    imageData.data.set([
      255,
      0,
      0,
      255, // Red
      0,
      255,
      0,
      255, // Green
      0,
      0,
      255,
      255, // Blue
      255,
      255,
      255,
      255 // White
    ])

    const result = applyHorizontalSmoothing(imageData, 4)

    //All pixels should have some averaging (not exact due to edge effects)
    // Just verify smoothing occurred
    for (let i = 0; i < 4; i++) {
      const idx = i * 4
      expect(result.data[idx]).toBeGreaterThan(0) // R has some value
      expect(result.data[idx + 1]).toBeGreaterThan(0) // G has some value
      expect(result.data[idx + 2]).toBeGreaterThan(0) // B has some value
      expect(result.data[idx + 3]).toBe(255) // A preserved
    }
  })

  it('handles edges correctly without out-of-bounds access', () => {
    const imageData = new ImageData(3, 1)
    imageData.data.set([
      255,
      0,
      0,
      255, // Red
      0,
      255,
      0,
      255, // Green
      0,
      0,
      255,
      255 // Blue
    ])

    const result = applyHorizontalSmoothing(imageData, 4)

    // Should not throw and produce valid output
    expect(result.width).toBe(3)
    expect(result.height).toBe(1)
    expect(result.data.length).toBe(12)
  })

  it('preserves alpha channel correctly', () => {
    const imageData = new ImageData(4, 1)
    imageData.data.set([
      255,
      0,
      0,
      128, // Red with 50% opacity
      0,
      255,
      0,
      255, // Green with 100% opacity
      0,
      0,
      255,
      200, // Blue with ~78% opacity
      128,
      128,
      128,
      180 // Gray
    ])

    const result = applyHorizontalSmoothing(imageData, 2)

    // Alpha channel should be smoothed like RGB channels
    // Just verify it's not unchanged (some averaging happened)
    expect(result.data[3]).toBeGreaterThan(128) // Alpha averaged with neighbor
    expect(result.data[3]).toBeLessThan(255)
  })

  it('works on multi-row images', () => {
    const imageData = new ImageData(2, 2)
    imageData.data.set([
      // Row 1
      255,
      0,
      0,
      255, // Red
      0,
      255,
      0,
      255, // Green
      // Row 2
      0,
      0,
      255,
      255, // Blue
      255,
      255,
      255,
      255 // White
    ])

    const result = applyHorizontalSmoothing(imageData, 2)

    // Each row should be smoothed independently
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)

    // Row 1, Pixel 0: average of Red(255,0,0) and Green(0,255,0) → (128,128,0)
    expect(result.data[0]).toBe(128) // (255+0)/2 = 127.5 → 128

    // Row 2, Pixel 0: average of Blue(0,0,255) and White(255,255,255) → (128,128,255)
    expect(result.data[8]).toBe(128) // (0+255)/2 = 127.5 → 128
  })
})
