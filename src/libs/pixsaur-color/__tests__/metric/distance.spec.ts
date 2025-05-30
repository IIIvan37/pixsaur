import { Vector } from '../../src/type'
import {
  cie76Distance,
  deltaE2000Distance,
  euclideanDistance
} from '../../src/metric/distance'

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    const a: Vector = [0, 0, 0]
    const b: Vector = [0, 0, 0]
    expect(euclideanDistance(a, b)).toBe(0)
  })

  it('calculates correct distance for simple vector', () => {
    const a: Vector = [0, 0, 0]
    const b: Vector = [3, 4, 0]
    expect(euclideanDistance(a, b)).toBeCloseTo(5 ** 2, 6) // 3-4-5 triangle
  })

  it('works for RGB-like values', () => {
    const a: Vector = [255, 0, 0]
    const b: Vector = [0, 255, 0]
    expect(euclideanDistance(a, b)).toBeCloseTo(255 ** 2 + 255 ** 2, 4)
  })
})

describe('cie76Distance', () => {
  it('identical Lab values returns 0', () => {
    const a: Vector = [50, 20, 30]
    const b: Vector = [50, 20, 30]
    expect(cie76Distance(a, b)).toBe(0)
  })

  it('returns correct euclidean distance in Lab space', () => {
    const a: Vector = [0, 0, 0]
    const b: Vector = [100, 0, 0]
    expect(cie76Distance(a, b)).toBe(100 ** 2)
  })

  it('returns correct distance for nontrivial Lab', () => {
    const a: Vector = [50, 50, 50]
    const b: Vector = [60, 60, 60]
    expect(cie76Distance(a, b)).toBeCloseTo(10 ** 2 + 10 ** 2 + 10 ** 2, 6)
  })
})

describe('deltaE2000', () => {
  it('identical Lab values returns 0', () => {
    const a: Vector = [50, 20, 30]
    const b: Vector = [50, 20, 30]
    expect(deltaE2000Distance(a, b)).toBeCloseTo(0, 6)
  })

  it('returns small deltaE2000 between similar colors', () => {
    const a: Vector = [50, 20, 30]
    const b: Vector = [50, 22, 29]
    expect(deltaE2000Distance(a, b)).toBeLessThan(3)
  })

  it('returns known deltaE2000 from standard dataset', () => {
    const a: Vector = [50.0, 2.6772, -79.7751]
    const b: Vector = [50.0, 0.0, -82.7485]
    expect(deltaE2000Distance(a, b)).toBeCloseTo(2.0425, 3) // référence ISO
  })

  it('returns known deltaE2000 (dataset 2)', () => {
    const a: Vector = [50.0, 3.1571, -77.2803]
    const b: Vector = [50.0, 0.0, -82.7485]
    expect(deltaE2000Distance(a, b)).toBeCloseTo(2.8615, 3) // référence ISO
  })
})
