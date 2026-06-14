import { describe, expect, it } from 'vitest'
import type { Vector } from '../pixsaur-color/src/type'
import { medianCut, type WeightedPixel } from './median-cut'

const px = (color: Vector<'RGB'>, weight = 1): WeightedPixel => ({
  color,
  weight
})

describe('medianCut', () => {
  it('returns an empty array for no pixels', () => {
    expect(medianCut([], 4)).toEqual([])
  })

  it('passes colors through when there are at most numColors', () => {
    const pixels = [px([255, 0, 0]), px([0, 255, 0])]
    expect(medianCut(pixels, 4)).toEqual([
      [255, 0, 0],
      [0, 255, 0]
    ])
  })

  it('passes colors through at exactly numColors', () => {
    const pixels = [px([1, 1, 1]), px([2, 2, 2]), px([3, 3, 3])]
    expect(medianCut(pixels, 3)).toHaveLength(3)
  })

  it('reduces to numColors representatives when there are more pixels', () => {
    // Three well-separated clusters.
    const pixels = [
      px([250, 0, 0]),
      px([240, 10, 5]),
      px([0, 250, 0]),
      px([5, 240, 10]),
      px([0, 0, 250]),
      px([10, 5, 240])
    ]
    const out = medianCut(pixels, 3)
    expect(out).toHaveLength(3)
    // Every representative comes from the input set.
    const inputKeys = new Set(pixels.map((p) => p.color.join(',')))
    for (const c of out) expect(inputKeys.has(c.join(','))).toBe(true)
  })

  it('picks the most frequent color as a box representative', () => {
    // A heavy red plus a far blue: they end up in separate boxes, and the red
    // box keeps the heaviest red.
    const pixels = [
      px([255, 0, 0], 100),
      px([250, 5, 5], 1),
      px([0, 0, 255], 1)
    ]
    const out = medianCut(pixels, 2)
    expect(out).toHaveLength(2)
    expect(out).toContainEqual([255, 0, 0])
    expect(out).toContainEqual([0, 0, 255])
  })

  it('handles identical colors without producing empty boxes', () => {
    const pixels = [
      px([100, 100, 100]),
      px([100, 100, 100]),
      px([100, 100, 100]),
      px([100, 100, 100])
    ]
    const out = medianCut(pixels, 2)
    expect(out).toHaveLength(2)
    for (const c of out) expect(c).toEqual([100, 100, 100])
  })
})
