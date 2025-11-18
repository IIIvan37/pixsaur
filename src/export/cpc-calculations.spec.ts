import { describe, expect, it } from 'vitest'
import {
  getAspectRatioMultipliers,
  getPixelsPerByte,
  getWidthStepForMode,
  quantifyToCPCPlus,
  quantizeCPC
} from '@/export'

describe('cpc-calculations', () => {
  it('returns correct pixels per byte for each mode', () => {
    expect(getPixelsPerByte(0)).toBe(2)
    expect(getPixelsPerByte(1)).toBe(4)
    expect(getPixelsPerByte(2)).toBe(8)
  })

  it('returns correct width step for each mode', () => {
    expect(getWidthStepForMode(0)).toBe(4)
    expect(getWidthStepForMode(1)).toBe(8)
    expect(getWidthStepForMode(2)).toBe(16)
  })

  it('returns correct aspect ratio multipliers', () => {
    expect(getAspectRatioMultipliers(0)).toEqual({
      widthMultiplier: 2,
      heightMultiplier: 1
    })
    expect(getAspectRatioMultipliers(1)).toEqual({
      widthMultiplier: 1,
      heightMultiplier: 1
    })
    expect(getAspectRatioMultipliers(2)).toEqual({
      widthMultiplier: 1,
      heightMultiplier: 2
    })
  })

  it('quantize functions behave as expected', () => {
    expect(quantizeCPC(0)).toBe(0)
    expect(quantizeCPC(128)).toBe(128)
    expect(quantizeCPC(255)).toBe(255)

    expect(quantifyToCPCPlus(0)).toBe(0)
    expect(quantifyToCPCPlus(255)).toBe(255)
  })
})
