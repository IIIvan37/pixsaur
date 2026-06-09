import { describe, expect, it } from 'vitest'
import { linearToSrgb, srgbToLinear } from './srgb-linear'

describe('srgbToLinear', () => {
  it('maps the endpoints exactly', () => {
    expect(srgbToLinear(0)).toBe(0)
    expect(srgbToLinear(1)).toBeCloseTo(1, 6)
  })

  it('maps mid-gray (0.5 sRGB) to ~0.214 linear', () => {
    expect(srgbToLinear(0.5)).toBeCloseTo(0.2140411, 5)
  })

  it('uses the linear segment below the threshold', () => {
    // c <= 0.04045 -> c / 12.92
    expect(srgbToLinear(0.02)).toBeCloseTo(0.02 / 12.92, 9)
  })
})

describe('linearToSrgb', () => {
  it('maps the endpoints exactly', () => {
    expect(linearToSrgb(0)).toBe(0)
    expect(linearToSrgb(1)).toBeCloseTo(1, 6)
  })

  it('is the inverse of srgbToLinear across the 0..255 range', () => {
    for (let i = 0; i <= 255; i++) {
      const c = i / 255
      expect(linearToSrgb(srgbToLinear(c))).toBeCloseTo(c, 6)
    }
  })
})
