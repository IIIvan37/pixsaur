import { describe, expect, it } from 'vitest'

import {
  calculateHue,
  calculateHueDistance,
  calculateSaturation,
  calculateValue,
  rgbToHsv
} from './hsv'

describe('calculateHue', () => {
  it('should calculate hue for primary colors', () => {
    expect(calculateHue([255, 0, 0])).toBeCloseTo(0, 0) // Red
    expect(calculateHue([0, 255, 0])).toBeCloseTo(120, 0) // Green
    expect(calculateHue([0, 0, 255])).toBeCloseTo(240, 0) // Blue
  })

  it('should calculate hue for secondary colors', () => {
    expect(calculateHue([255, 255, 0])).toBeCloseTo(60, 0) // Yellow
    expect(calculateHue([0, 255, 255])).toBeCloseTo(180, 0) // Cyan
    expect(calculateHue([255, 0, 255])).toBeCloseTo(300, 0) // Magenta
  })

  it('should return -1 for achromatic colors (gray)', () => {
    expect(calculateHue([0, 0, 0])).toBe(-1) // Black
    expect(calculateHue([128, 128, 128])).toBe(-1) // Gray
    expect(calculateHue([255, 255, 255])).toBe(-1) // White
  })

  it('should handle near-gray colors with custom threshold', () => {
    // Very slightly desaturated gray
    expect(calculateHue([128, 129, 128], 0.01)).toBe(-1)
    // Same color but with lower threshold
    const hue = calculateHue([128, 129, 128], 0.001)
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThanOrEqual(360)
  })
})

describe('calculateHueDistance', () => {
  it('should calculate circular distance between hues', () => {
    expect(calculateHueDistance(0, 90)).toBe(90)
    expect(calculateHueDistance(90, 0)).toBe(90)
    expect(calculateHueDistance(0, 180)).toBe(180)
  })

  it('should use circular distance for values > 180', () => {
    expect(calculateHueDistance(0, 270)).toBe(90) // 360 - 270 = 90
    expect(calculateHueDistance(10, 350)).toBe(20) // 360 - 340 = 20
    expect(calculateHueDistance(350, 10)).toBe(20)
  })

  it('should return 180 for achromatic colors', () => {
    expect(calculateHueDistance(-1, 120)).toBe(180)
    expect(calculateHueDistance(120, -1)).toBe(180)
    expect(calculateHueDistance(-1, -1)).toBe(180)
  })

  it('should return 0 for identical hues', () => {
    expect(calculateHueDistance(120, 120)).toBe(0)
    expect(calculateHueDistance(0, 0)).toBe(0)
  })
})

describe('calculateSaturation', () => {
  it('should return 1 for pure colors', () => {
    expect(calculateSaturation([255, 0, 0])).toBe(1) // Red
    expect(calculateSaturation([0, 255, 0])).toBe(1) // Green
    expect(calculateSaturation([0, 0, 255])).toBe(1) // Blue
  })

  it('should return 0 for grayscale colors', () => {
    expect(calculateSaturation([0, 0, 0])).toBe(0) // Black
    expect(calculateSaturation([128, 128, 128])).toBe(0) // Gray
    expect(calculateSaturation([255, 255, 255])).toBe(0) // White
  })

  it('should calculate intermediate saturation', () => {
    expect(calculateSaturation([255, 128, 128])).toBeCloseTo(0.498, 2) // Desaturated red
    expect(calculateSaturation([200, 100, 100])).toBeCloseTo(0.5, 2)
  })
})

describe('calculateValue', () => {
  it('should return 1 for maximum brightness colors', () => {
    expect(calculateValue([255, 0, 0])).toBeCloseTo(1, 2)
    expect(calculateValue([255, 255, 0])).toBeCloseTo(1, 2)
    expect(calculateValue([255, 255, 255])).toBeCloseTo(1, 2)
  })

  it('should return 0 for black', () => {
    expect(calculateValue([0, 0, 0])).toBe(0)
  })

  it('should calculate intermediate values', () => {
    expect(calculateValue([128, 0, 0])).toBeCloseTo(0.502, 2)
    expect(calculateValue([64, 32, 16])).toBeCloseTo(0.251, 2)
  })
})

describe('rgbToHsv', () => {
  it('should convert pure red to HSV', () => {
    const hsv = rgbToHsv([255, 0, 0])
    expect(hsv.h).toBeCloseTo(0, 0)
    expect(hsv.s).toBe(1)
    expect(hsv.v).toBeCloseTo(1, 2)
  })

  it('should convert pure green to HSV', () => {
    const hsv = rgbToHsv([0, 255, 0])
    expect(hsv.h).toBeCloseTo(120, 0)
    expect(hsv.s).toBe(1)
    expect(hsv.v).toBeCloseTo(1, 2)
  })

  it('should convert gray to HSV with hue -1', () => {
    const hsv = rgbToHsv([128, 128, 128])
    expect(hsv.h).toBe(-1)
    expect(hsv.s).toBe(0)
    expect(hsv.v).toBeCloseTo(0.502, 2)
  })

  it('should convert desaturated color', () => {
    const hsv = rgbToHsv([200, 100, 100])
    expect(hsv.h).toBeCloseTo(0, 0) // Reddish
    expect(hsv.s).toBeCloseTo(0.5, 2)
    expect(hsv.v).toBeCloseTo(0.784, 2)
  })
})
