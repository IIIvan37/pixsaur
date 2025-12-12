import { describe, expect, it } from 'vitest'

import {
  calculateHue,
  calculateHueDistance,
  calculateMinHueDistance,
  calculateMinHueDistanceInSet,
  calculateSaturation,
  calculateValue,
  isVisuallyColorful,
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

describe('calculateMinHueDistance', () => {
  it('should calculate minimum hue distance to a set of colors', () => {
    // Red candidate compared to green and blue
    const dist = calculateMinHueDistance(
      [255, 0, 0],
      [
        [0, 255, 0],
        [0, 0, 255]
      ]
    )
    // Red (0) to Green (120) = 120, Red (0) to Blue (240) = 120
    expect(dist).toBeCloseTo(120, 0)
  })

  it('should return 180 for low saturation candidate', () => {
    // Gray candidate - saturation < threshold
    const dist = calculateMinHueDistance([128, 128, 128], [[255, 0, 0]])
    expect(dist).toBe(180)
  })

  it('should ignore low saturation colors in comparison', () => {
    // Red candidate, only gray in set
    const dist = calculateMinHueDistance(
      [255, 0, 0],
      [
        [128, 128, 128],
        [100, 100, 100]
      ]
    )
    // No saturated colors to compare, should remain at max
    expect(dist).toBe(180)
  })

  it('should find closest color in terms of hue', () => {
    // Orange candidate compared to red and blue
    const dist = calculateMinHueDistance(
      [255, 128, 0], // Orange ~30°
      [
        [255, 0, 0], // Red 0°
        [0, 0, 255] // Blue 240°
      ]
    )
    // Should be close to red
    expect(dist).toBeLessThan(60)
  })

  it('should respect custom saturation threshold', () => {
    // Slightly saturated color with high threshold
    const dist = calculateMinHueDistance(
      [255, 200, 200], // Low saturation
      [[0, 255, 0]],
      0.5 // High threshold
    )
    expect(dist).toBe(180) // Below threshold
  })
})

describe('calculateMinHueDistanceInSet', () => {
  it('should find minimum distance between colors in set', () => {
    // Red, Green, Blue - all 120° apart
    const dist = calculateMinHueDistanceInSet([
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ])
    expect(dist).toBeCloseTo(120, 0)
  })

  it('should find closer colors', () => {
    // Red and Orange are close
    const dist = calculateMinHueDistanceInSet([
      [255, 0, 0], // Red 0°
      [255, 128, 0], // Orange ~30°
      [0, 0, 255] // Blue 240°
    ])
    expect(dist).toBeLessThan(60)
  })

  it('should return 180 for all achromatic colors', () => {
    const dist = calculateMinHueDistanceInSet([
      [0, 0, 0],
      [128, 128, 128],
      [255, 255, 255]
    ])
    expect(dist).toBe(180)
  })

  it('should ignore achromatic colors in calculation', () => {
    const dist = calculateMinHueDistanceInSet([
      [255, 0, 0],
      [128, 128, 128], // Gray - ignored
      [0, 255, 0]
    ])
    // Only comparing red and green
    expect(dist).toBeCloseTo(120, 0)
  })

  it('should handle single saturated color', () => {
    const dist = calculateMinHueDistanceInSet([
      [255, 0, 0],
      [128, 128, 128],
      [100, 100, 100]
    ])
    // Only one saturated color, no pairs to compare
    expect(dist).toBe(180)
  })

  it('should handle empty set', () => {
    const dist = calculateMinHueDistanceInSet([])
    expect(dist).toBe(180)
  })
})

describe('isVisuallyColorful', () => {
  it('should return true for saturated colors below maxValue threshold', () => {
    // Using maxValue=1.0 to allow max brightness colors
    expect(isVisuallyColorful([255, 0, 0], 0.3, 0.2, 1.0)).toBe(true) // Red
    expect(isVisuallyColorful([0, 255, 0], 0.3, 0.2, 1.0)).toBe(true) // Green
    // Blue has low luminance (0.0722), needs very low minLuminance
    // With all params: minSat=0.3, minLum=0.05, maxVal=1.0, highSatThresh=0.7, highSatMinLum=0.05
    expect(isVisuallyColorful([0, 0, 255], 0.3, 0.05, 1.0, 0.7, 0.05)).toBe(
      true
    ) // Blue
  })

  it('should return false for pure colors at max value by default', () => {
    // Default maxValue is 0.95, pure colors have value=1.0
    expect(isVisuallyColorful([255, 0, 0])).toBe(false) // value=1 > 0.95
  })

  it('should return false for grayscale colors', () => {
    expect(isVisuallyColorful([0, 0, 0])).toBe(false) // Black
    expect(isVisuallyColorful([128, 128, 128])).toBe(false) // Gray
    expect(isVisuallyColorful([255, 255, 255])).toBe(false) // White
  })

  it('should return false for pale/desaturated colors', () => {
    expect(isVisuallyColorful([255, 200, 200])).toBe(false) // Pale pink
    expect(isVisuallyColorful([200, 200, 255])).toBe(false) // Pale blue
  })

  it('should return false for very dark colors', () => {
    expect(isVisuallyColorful([20, 0, 0])).toBe(false) // Very dark red
    expect(isVisuallyColorful([0, 20, 0])).toBe(false) // Very dark green
  })

  it('should allow highly saturated colors with lower luminance threshold', () => {
    // Deep saturated blue - value=0.78 < 0.95, saturation=1
    // Blue luminance = 200 * 0.0722 / 255 ≈ 0.057
    // High saturation (1.0 > 0.7) allows lower luminance (0.15 default for high sat)
    // But 0.057 < 0.15, so still false with defaults
    // Need to lower highSaturationMinLuminance
    expect(isVisuallyColorful([0, 0, 200], 0.3, 0.2, 0.95, 0.7, 0.05)).toBe(
      true
    )
  })

  it('should respect custom saturation threshold', () => {
    // Color with ~0.29 saturation
    const paleColor: [number, number, number] = [255, 180, 180]
    // saturation = (255-180)/255 ≈ 0.29
    // value = 1.0 > 0.95, so false even with low saturation threshold
    expect(isVisuallyColorful(paleColor, 0.1, 0.2, 1.0)).toBe(true)
    expect(isVisuallyColorful(paleColor, 0.5)).toBe(false)
  })

  it('should return false for colors that are too bright (value > maxValue)', () => {
    // Pure red has value=1.0 which exceeds default maxValue=0.95
    expect(isVisuallyColorful([255, 0, 0])).toBe(false)
  })

  it('should handle medium saturation colors with medium value', () => {
    // [200, 100, 100]: saturation=0.5, value=0.78, luminance≈0.28
    // Meets all default thresholds
    expect(isVisuallyColorful([200, 100, 100])).toBe(true)
    // [100, 200, 100]: saturation=0.5, value=0.78, luminance≈0.58
    expect(isVisuallyColorful([100, 200, 100])).toBe(true)
  })

  it('should use highSaturationMinLuminance for highly saturated colors', () => {
    // Color with high saturation but low luminance
    const darkSaturated: [number, number, number] = [150, 0, 0]
    // saturation=1, value=0.59, luminance=150*0.2126/255≈0.125
    // saturation > 0.7 so effectiveMinLuminance = 0.15
    // 0.125 < 0.15, so should be false with defaults
    expect(isVisuallyColorful(darkSaturated)).toBe(false)
    // With lower highSaturationMinLuminance
    expect(isVisuallyColorful(darkSaturated, 0.3, 0.2, 0.95, 0.7, 0.1)).toBe(
      true
    )
  })
})
