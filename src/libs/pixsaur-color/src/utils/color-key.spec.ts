import { describe, expect, it } from 'vitest'
import type { Vector } from '../type'
import { colorToKey, createColorKeySet, keyToColor } from './color-key'

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
