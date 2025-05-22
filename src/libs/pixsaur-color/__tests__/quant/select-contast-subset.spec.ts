import { describe, it, expect } from 'vitest'
import { selectContrastedSubset } from '../../src/quant/select-contrast-subset'
import { Vector } from '../../src/type'

// Helper: Euclidean distance for [0,1] RGB (accepts Vector)
const dist = (a: Vector, b: Vector) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

describe('selectContrastedSubset', () => {
  it('returns all candidates if candidates.length <= size', () => {
    const cands: Vector[] = [
      [0, 0, 0],
      [1, 1, 1]
    ]
    expect(selectContrastedSubset(cands, 3, dist)).toEqual(cands)
    expect(selectContrastedSubset(cands, 2, dist)).toEqual(cands)
  })

  it('selects the most contrasted subset (max min distance)', () => {
    const cands: Vector[] = [
      [0, 0, 0], // black (dark)
      [1, 1, 1], // white (bright)
      [0.5, 0.5, 0.5], // gray (mid)
      [1, 0, 0] // red (bright)
    ]
    // Should pick black and white for size=2
    const result = selectContrastedSubset(cands, 2, dist)
    expect(result).toContainEqual([0, 0, 0])
    expect(result).toContainEqual([1, 1, 1])
  })

  it('prefers sets with both dark and bright colors', () => {
    const cands: Vector[] = [
      [0, 0, 0], // dark
      [0.1, 0.1, 0.1], // dark
      [1, 1, 1], // bright
      [0.9, 0.9, 0.9], // bright
      [0.5, 0.5, 0.5] // mid
    ]
    // For size=2, should not pick two darks or two brights if possible
    const result = selectContrastedSubset(cands, 2, dist)
    const hasDark = result.some((c) => c[0] < 0.2)
    const hasBright = result.some((c) => c[0] > 0.8)
    expect(hasDark && hasBright).toBe(true)
  })

  it('returns a subset of the requested size', () => {
    const cands: Vector[] = [
      [0, 0, 0],
      [1, 1, 1],
      [0.5, 0.5, 0.5],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]
    const result = selectContrastedSubset(cands, 3, dist)
    expect(result.length).toBe(3)
  })
})
