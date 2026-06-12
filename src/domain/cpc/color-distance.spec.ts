import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  areColorsSimilar,
  DEFAULT_PERCEPTUAL_THRESHOLD,
  isColorTooClose,
  perceptualDistance
} from './color-distance'

describe('perceptualDistance', () => {
  it('is zero for identical colors', () => {
    expect(perceptualDistance([12, 34, 56], [12, 34, 56])).toBe(0)
  })

  it('is symmetric', () => {
    const a: Vector = [10, 80, 200]
    const b: Vector = [200, 30, 40]
    expect(perceptualDistance(a, b)).toBeCloseTo(perceptualDistance(b, a))
  })

  it('weights green more than red and red more than blue', () => {
    // weightedRGBDistance coefficients: r 0.299, g 0.587, b 0.114
    const redDelta = perceptualDistance([0, 0, 0], [255, 0, 0])
    const greenDelta = perceptualDistance([0, 0, 0], [0, 255, 0])
    const blueDelta = perceptualDistance([0, 0, 0], [0, 0, 255])
    expect(greenDelta).toBeGreaterThan(redDelta)
    expect(redDelta).toBeGreaterThan(blueDelta)
  })
})

describe('areColorsSimilar', () => {
  it('treats identical colors as similar', () => {
    expect(areColorsSimilar([5, 5, 5], [5, 5, 5])).toBe(true)
  })

  it('treats far-apart colors as not similar (default threshold)', () => {
    expect(areColorsSimilar([0, 0, 0], [255, 255, 255])).toBe(false)
  })

  it('respects a custom threshold', () => {
    const a: Vector = [0, 0, 0]
    const b: Vector = [255, 255, 255] // distance == 255
    expect(areColorsSimilar(a, b, 254)).toBe(false)
    expect(areColorsSimilar(a, b, 256)).toBe(true)
  })

  it('defaults to DEFAULT_PERCEPTUAL_THRESHOLD', () => {
    expect(DEFAULT_PERCEPTUAL_THRESHOLD).toBe(50)
  })
})

describe('isColorTooClose', () => {
  it('returns false when the reference set is empty', () => {
    expect(isColorTooClose([10, 10, 10], [])).toBe(false)
  })

  it('returns true when close to any reference color', () => {
    const refs: Vector[] = [
      [255, 255, 255],
      [10, 10, 10]
    ]
    expect(isColorTooClose([11, 10, 10], refs)).toBe(true)
  })

  it('returns false when far from every reference color', () => {
    const refs: Vector[] = [[0, 0, 0]]
    expect(isColorTooClose([255, 255, 255], refs)).toBe(false)
  })
})
