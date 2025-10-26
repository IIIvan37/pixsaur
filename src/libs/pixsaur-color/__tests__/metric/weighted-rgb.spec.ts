import { describe, expect, it } from 'vitest'
import {
  euclideanDistance,
  weightedRGBDistance
} from '../../src/metric/distance'
import type { Vector } from '../../src/type'

describe('weightedRGBDistance', () => {
  it('returns 0 for identical colors', () => {
    const a: Vector = [128, 128, 128]
    const b: Vector = [128, 128, 128]
    expect(weightedRGBDistance(a, b)).toBe(0)
  })

  it('applies perceptual weights (green > red > blue)', () => {
    const base: Vector = [100, 100, 100]

    // Same distance (10 units) on each channel
    const redShift: Vector = [110, 100, 100]
    const greenShift: Vector = [100, 110, 100]
    const blueShift: Vector = [100, 100, 110]

    const redDist = weightedRGBDistance(base, redShift)
    const greenDist = weightedRGBDistance(base, greenShift)
    const blueDist = weightedRGBDistance(base, blueShift)

    // Green should have highest weight (0.587)
    expect(greenDist).toBeGreaterThan(redDist)
    // Red should have medium weight (0.299)
    expect(redDist).toBeGreaterThan(blueDist)
    // Blue should have lowest weight (0.114)
  })

  it('uses ITU-R BT.601 luma coefficients', () => {
    const a: Vector = [0, 0, 0]
    const b: Vector = [100, 100, 100]

    const dist = weightedRGBDistance(a, b)

    // Expected: (100^2 * 0.299) + (100^2 * 0.587) + (100^2 * 0.114)
    // = 10000 * (0.299 + 0.587 + 0.114) = 10000 * 1.0 = 10000
    expect(dist).toBeCloseTo(10000, 1)
  })

  it('is more sensitive to green changes than red', () => {
    const base: Vector = [128, 128, 128]
    const redDelta: Vector = [228, 128, 128] // +100 red
    const greenDelta: Vector = [128, 228, 128] // +100 green

    const redDist = weightedRGBDistance(base, redDelta)
    const greenDist = weightedRGBDistance(base, greenDelta)

    // Green weight (0.587) is ~2× red weight (0.299)
    expect(greenDist / redDist).toBeCloseTo(0.587 / 0.299, 1)
  })

  it('is more sensitive to red changes than blue', () => {
    const base: Vector = [128, 128, 128]
    const redDelta: Vector = [228, 128, 128] // +100 red
    const blueDelta: Vector = [128, 128, 228] // +100 blue

    const redDist = weightedRGBDistance(base, redDelta)
    const blueDist = weightedRGBDistance(base, blueDelta)

    // Red weight (0.299) is ~2.6× blue weight (0.114)
    expect(redDist / blueDist).toBeCloseTo(0.299 / 0.114, 1)
  })

  it('differs from euclidean distance for non-uniform changes', () => {
    const a: Vector = [0, 0, 0]
    const b: Vector = [50, 100, 50]

    const weighted = weightedRGBDistance(a, b)
    const euclidean = euclideanDistance(a, b)

    // They should differ because of perceptual weighting
    expect(weighted).not.toBe(euclidean)

    // Weighted should favor green more
    // weighted = 50^2*0.299 + 100^2*0.587 + 50^2*0.114
    //          = 2500*0.299 + 10000*0.587 + 2500*0.114
    //          = 747.5 + 5870 + 285 = 6902.5
    expect(weighted).toBeCloseTo(6902.5, 1)

    // euclidean = 50^2 + 100^2 + 50^2 = 2500 + 10000 + 2500 = 15000
    expect(euclidean).toBe(15000)
  })

  it('works correctly for black and white', () => {
    const black: Vector = [0, 0, 0]
    const white: Vector = [255, 255, 255]

    const dist = weightedRGBDistance(black, white)

    // Expected: (255^2 * 0.299) + (255^2 * 0.587) + (255^2 * 0.114)
    // = 65025 * 1.0 = 65025
    expect(dist).toBeCloseTo(65025, 1)
  })

  it('is symmetric (distance from A to B equals B to A)', () => {
    const a: Vector = [100, 150, 200]
    const b: Vector = [50, 75, 100]

    expect(weightedRGBDistance(a, b)).toBe(weightedRGBDistance(b, a))
  })

  it('handles edge case of pure channel changes', () => {
    const black: Vector = [0, 0, 0]
    const pureRed: Vector = [255, 0, 0]
    const pureGreen: Vector = [0, 255, 0]
    const pureBlue: Vector = [0, 0, 255]

    const redDist = weightedRGBDistance(black, pureRed)
    const greenDist = weightedRGBDistance(black, pureGreen)
    const blueDist = weightedRGBDistance(black, pureBlue)

    // Expected values
    expect(redDist).toBeCloseTo(255 ** 2 * 0.299, 1) // ~19448
    expect(greenDist).toBeCloseTo(255 ** 2 * 0.587, 1) // ~38169
    expect(blueDist).toBeCloseTo(255 ** 2 * 0.114, 1) // ~7408

    // Verify ordering
    expect(greenDist).toBeGreaterThan(redDist)
    expect(redDist).toBeGreaterThan(blueDist)
  })
})
