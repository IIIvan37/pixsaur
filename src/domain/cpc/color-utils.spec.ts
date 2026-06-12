import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  colorToKey,
  createColorKeySet,
  findDarkestInPalette,
  findDarkestValidColor,
  keyToColor
} from './color-utils'

describe('colorToKey / keyToColor', () => {
  it('builds a comma-separated key', () => {
    expect(colorToKey([12, 34, 56])).toBe('12,34,56')
  })

  it('round-trips a color through its key', () => {
    const color: Vector = [10, 20, 30]
    expect(keyToColor(colorToKey(color))).toEqual(color)
  })
})

describe('createColorKeySet', () => {
  it('produces a set of keys and de-duplicates', () => {
    const set = createColorKeySet([
      [1, 2, 3],
      [1, 2, 3],
      [4, 5, 6]
    ])
    expect(set.size).toBe(2)
    expect(set.has('1,2,3')).toBe(true)
    expect(set.has('4,5,6')).toBe(true)
  })
})

describe('findDarkestInPalette', () => {
  it('returns the lowest-luminance color', () => {
    const palette: Vector[] = [
      [255, 255, 255],
      [0, 0, 0],
      [255, 0, 0]
    ]
    expect(findDarkestInPalette(palette)).toEqual([0, 0, 0])
  })

  it('returns the fallback for an empty palette', () => {
    expect(findDarkestInPalette([])).toEqual([0, 0, 0])
    expect(findDarkestInPalette([], [7, 8, 9])).toEqual([7, 8, 9])
  })
})

describe('findDarkestValidColor', () => {
  it('ignores [-1,-1,-1] slots before comparing', () => {
    const palette: Vector[] = [
      [-1, -1, -1],
      [100, 100, 100],
      [200, 200, 200]
    ]
    expect(findDarkestValidColor(palette)).toEqual([100, 100, 100])
  })

  it('returns the fallback when every slot is ignored', () => {
    const palette: Vector[] = [
      [-1, -1, -1],
      [-1, -1, -1]
    ]
    expect(findDarkestValidColor(palette)).toEqual([0, 0, 0])
    expect(findDarkestValidColor(palette, [5, 5, 5])).toEqual([5, 5, 5])
  })
})
