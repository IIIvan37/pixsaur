import { describe, it, expect } from 'vitest'
import { applyHueAdjustment } from './hue-adjustment'

describe('applyHueAdjustment', () => {
  it('should return a copy when hueShift is 0', () => {
    const imageData = new ImageData(2, 2)
    imageData.data.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255])

    const result = applyHueAdjustment(imageData, 0)

    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(Array.from(result.data)).toEqual(Array.from(imageData.data))
  })

  it('should rotate red to green with +120° shift', () => {
    const imageData = new ImageData(1, 1)
    imageData.data.set([255, 0, 0, 255]) // Pure red

    const result = applyHueAdjustment(imageData, 120)

    // Red (0°) + 120° = Green (120°)
    expect(result.data[0]).toBe(0)   // R
    expect(result.data[1]).toBe(255) // G
    expect(result.data[2]).toBe(0)   // B
    expect(result.data[3]).toBe(255) // A (preserved)
  })

  it('should rotate green to blue with +120° shift', () => {
    const imageData = new ImageData(1, 1)
    imageData.data.set([0, 255, 0, 255]) // Pure green

    const result = applyHueAdjustment(imageData, 120)

    // Green (120°) + 120° = Blue (240°)
    expect(result.data[0]).toBe(0)   // R
    expect(result.data[1]).toBe(0)   // G
    expect(result.data[2]).toBe(255) // B
    expect(result.data[3]).toBe(255) // A
  })

  it('should rotate blue to red with +120° shift', () => {
    const imageData = new ImageData(1, 1)
    imageData.data.set([0, 0, 255, 255]) // Pure blue

    const result = applyHueAdjustment(imageData, 120)

    // Blue (240°) + 120° = Red (360° = 0°)
    expect(result.data[0]).toBe(255) // R
    expect(result.data[1]).toBe(0)   // G
    expect(result.data[2]).toBe(0)   // B
    expect(result.data[3]).toBe(255) // A
  })

  it('should handle negative hue shifts', () => {
    const imageData = new ImageData(1, 1)
    imageData.data.set([255, 0, 0, 255]) // Red

    const result = applyHueAdjustment(imageData, -120)

    // Red (0°) - 120° = Blue (240°)
    expect(result.data[0]).toBe(0)   // R
    expect(result.data[1]).toBe(0)   // G
    expect(result.data[2]).toBe(255) // B
  })

  it('should preserve grayscale (achromatic colors)', () => {
    const imageData = new ImageData(1, 1)
    imageData.data.set([128, 128, 128, 255]) // Gray

    const result = applyHueAdjustment(imageData, 180)

    // Grayscale has no hue, should remain unchanged
    expect(result.data[0]).toBe(128)
    expect(result.data[1]).toBe(128)
    expect(result.data[2]).toBe(128)
    expect(result.data[3]).toBe(255)
  })

  it('should handle full 360° rotation (return to original)', () => {
    const imageData = new ImageData(1, 1)
    imageData.data.set([200, 100, 50, 255])

    const result = applyHueAdjustment(imageData, 360)

    // 360° rotation = full circle, should be back to original
    expect(result.data[0]).toBe(200)
    expect(result.data[1]).toBe(100)
    expect(result.data[2]).toBe(50)
    expect(result.data[3]).toBe(255)
  })

  it('should preserve alpha channel', () => {
    const imageData = new ImageData(2, 1)
    imageData.data.set([255, 0, 0, 128, 0, 255, 0, 200]) // Red semi-transparent, green opaque

    const result = applyHueAdjustment(imageData, 60)

    expect(result.data[3]).toBe(128) // First pixel alpha
    expect(result.data[7]).toBe(200) // Second pixel alpha
  })

  it('should handle multiple pixels correctly', () => {
    const imageData = new ImageData(2, 2)
    // Red, Green, Blue, White
    imageData.data.set([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255
    ])

    const result = applyHueAdjustment(imageData, 180)

    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    // Red + 180° = Cyan (0, 255, 255)
    expect(result.data[0]).toBe(0)
    expect(result.data[1]).toBe(255)
    expect(result.data[2]).toBe(255)
    // White stays white (achromatic)
    expect(result.data[12]).toBe(255)
    expect(result.data[13]).toBe(255)
    expect(result.data[14]).toBe(255)
  })
})
