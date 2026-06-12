import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  quantifyToCPCPlus,
  quantizeArrayCPCClassic,
  quantizeArrayCPCPlus,
  quantizeArrayForHardware,
  quantizeColorCPCClassic,
  quantizeColorCPCPlus,
  quantizeColorForHardware,
  quantizeCPC,
  toCPCPlusLevel
} from './quantization'

describe('quantizeCPC (Classic, 3 levels: 0/128/255)', () => {
  it('snaps each level to itself', () => {
    expect(quantizeCPC(0)).toBe(0)
    expect(quantizeCPC(128)).toBe(128)
    expect(quantizeCPC(255)).toBe(255)
  })

  it('rounds to the nearest level', () => {
    expect(quantizeCPC(60)).toBe(0) // closer to 0 than 128
    expect(quantizeCPC(65)).toBe(128) // crosses the 0/128 midpoint
    expect(quantizeCPC(191)).toBe(128)
    expect(quantizeCPC(192)).toBe(255)
  })

  it('keeps the lower level on an exact tie', () => {
    expect(quantizeCPC(64)).toBe(0) // 64 is equidistant from 0 and 128
  })

  it('clamps out-of-range input before snapping', () => {
    expect(quantizeCPC(-10)).toBe(0)
    expect(quantizeCPC(300)).toBe(255)
  })
})

describe('quantifyToCPCPlus (4-bit round-trip to 0-255)', () => {
  it('maps the extremes exactly', () => {
    expect(quantifyToCPCPlus(0)).toBe(0)
    expect(quantifyToCPCPlus(255)).toBe(255)
  })

  it('round-trips through the 16-level grid', () => {
    expect(quantifyToCPCPlus(128)).toBe(136) // level 8 -> 136
    expect(quantifyToCPCPlus(100)).toBe(102) // level 6 -> 102
    expect(quantifyToCPCPlus(8)).toBe(0) // rounds down to level 0
  })

  it('clamps out-of-range input', () => {
    expect(quantifyToCPCPlus(-5)).toBe(0)
    expect(quantifyToCPCPlus(1000)).toBe(255)
  })
})

describe('toCPCPlusLevel (0-15)', () => {
  it('maps to the 4-bit level', () => {
    expect(toCPCPlusLevel(0)).toBe(0)
    expect(toCPCPlusLevel(128)).toBe(8)
    expect(toCPCPlusLevel(255)).toBe(15)
  })

  it('clamps out-of-range input', () => {
    expect(toCPCPlusLevel(-1)).toBe(0)
    expect(toCPCPlusLevel(999)).toBe(15)
  })
})

describe('quantizeColor* (per-channel)', () => {
  it('quantizes a vector for Classic', () => {
    expect(quantizeColorCPCClassic([60, 65, 200])).toEqual([0, 128, 255])
  })

  it('quantizes a vector for Plus', () => {
    expect(quantizeColorCPCPlus([128, 100, 0])).toEqual([136, 102, 0])
  })

  it('dispatches on hardware', () => {
    expect(quantizeColorForHardware([60, 65, 200], 'classic')).toEqual([
      0, 128, 255
    ])
    expect(quantizeColorForHardware([128, 100, 0], 'plus')).toEqual([
      136, 102, 0
    ])
  })
})

describe('quantizeArrayForHardware (in-place)', () => {
  it('mutates the colors in place for Classic', () => {
    const colors: Vector[] = [
      [60, 65, 200],
      [10, 10, 10]
    ]
    const ref = colors[0]
    quantizeArrayCPCClassic(colors)
    expect(colors).toEqual([
      [0, 128, 255],
      [0, 0, 0]
    ])
    expect(colors[0]).toBe(ref) // same array instance, mutated
  })

  it('mutates the colors in place for Plus', () => {
    const colors: Vector[] = [[128, 100, 0]]
    quantizeArrayCPCPlus(colors)
    expect(colors).toEqual([[136, 102, 0]])
  })

  it('skips colors whose original key is locked', () => {
    const colors: Vector[] = [
      [60, 65, 200],
      [10, 10, 10]
    ]
    quantizeArrayCPCClassic(colors, new Set(['60,65,200']))
    expect(colors).toEqual([
      [60, 65, 200], // untouched: key was locked
      [0, 0, 0]
    ])
  })

  it('dispatches on hardware', () => {
    const classic: Vector[] = [[60, 65, 200]]
    const plus: Vector[] = [[128, 100, 0]]
    quantizeArrayForHardware(classic, 'classic')
    quantizeArrayForHardware(plus, 'plus')
    expect(classic).toEqual([[0, 128, 255]])
    expect(plus).toEqual([[136, 102, 0]])
  })
})
