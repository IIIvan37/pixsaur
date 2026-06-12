import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  IGNORED_SLOT,
  isIgnoredSlot,
  replaceIgnoredSlots
} from './ignored-slot'

describe('IGNORED_SLOT', () => {
  it('is the [-1,-1,-1] marker', () => {
    expect(IGNORED_SLOT).toEqual([-1, -1, -1])
  })
})

describe('isIgnoredSlot', () => {
  it('returns true only for the exact [-1,-1,-1] marker', () => {
    expect(isIgnoredSlot([-1, -1, -1])).toBe(true)
  })

  it('returns false for any other color, including partial matches', () => {
    expect(isIgnoredSlot([0, 0, 0])).toBe(false)
    expect(isIgnoredSlot([-1, -1, 0])).toBe(false)
    expect(isIgnoredSlot([-1, 0, -1])).toBe(false)
    expect(isIgnoredSlot([255, 255, 255])).toBe(false)
  })
})

describe('replaceIgnoredSlots', () => {
  it('replaces only the ignored slots and keeps the rest', () => {
    const palette: Vector[] = [
      [10, 20, 30],
      [-1, -1, -1],
      [40, 50, 60]
    ]
    expect(replaceIgnoredSlots(palette, [0, 0, 0])).toEqual([
      [10, 20, 30],
      [0, 0, 0],
      [40, 50, 60]
    ])
  })

  it('returns a new array without mutating the input', () => {
    const palette: Vector[] = [[-1, -1, -1]]
    const result = replaceIgnoredSlots(palette, [1, 2, 3])
    expect(result).not.toBe(palette)
    expect(palette).toEqual([[-1, -1, -1]])
  })

  it('is a no-op when there are no ignored slots', () => {
    const palette: Vector[] = [[10, 20, 30]]
    expect(replaceIgnoredSlots(palette, [0, 0, 0])).toEqual([[10, 20, 30]])
  })
})
