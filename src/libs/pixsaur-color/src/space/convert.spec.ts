import { describe, expect, it } from 'vitest'

import { getColorSpaceToRgbFn, getRgbToColorSpaceFn } from './convert'

describe('getRgbToColorSpaceFn', () => {
  it('should return identity function for RGB color space', () => {
    const fn = getRgbToColorSpaceFn('RGB')
    const input: [number, number, number] = [255, 128, 64]

    const result = fn(input)

    expect(result).toEqual([255, 128, 64])
  })

  it('should return a new array (not the same reference)', () => {
    const fn = getRgbToColorSpaceFn('RGB')
    const input: [number, number, number] = [100, 150, 200]

    const result = fn(input)

    expect(result).not.toBe(input)
    expect(result).toEqual(input)
  })

  it('should throw error for unsupported color space', () => {
    expect(() => getRgbToColorSpaceFn('LAB' as any)).toThrow(
      'Unsupported color space: LAB'
    )
    expect(() => getRgbToColorSpaceFn('HSV' as any)).toThrow(
      'Unsupported color space: HSV'
    )
  })
})

describe('getColorSpaceToRgbFn', () => {
  it('should return identity function for RGB color space', () => {
    const fn = getColorSpaceToRgbFn('RGB')
    const input: [number, number, number] = [255, 128, 64]

    const result = fn(input)

    expect(result).toEqual([255, 128, 64])
  })

  it('should return a new array (not the same reference)', () => {
    const fn = getColorSpaceToRgbFn('RGB')
    const input: [number, number, number] = [100, 150, 200]

    const result = fn(input)

    expect(result).not.toBe(input)
    expect(result).toEqual(input)
  })

  it('should throw error for unsupported color space', () => {
    expect(() => getColorSpaceToRgbFn('LAB' as any)).toThrow(
      'Unsupported color space: LAB'
    )
    expect(() => getColorSpaceToRgbFn('XYZ' as any)).toThrow(
      'Unsupported color space: XYZ'
    )
  })
})
