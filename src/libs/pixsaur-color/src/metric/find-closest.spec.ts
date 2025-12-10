import { describe, expect, it } from 'vitest'
import type { Vector } from '../type'
import { euclideanDistance, weightedRGBDistance } from './distance'
import { findClosestColorIndex } from './find-closest'

describe('findClosestColorIndex', () => {
  it('should find the closest color using euclidean distance', () => {
    const color: Vector = [128, 64, 200]
    const palette: Vector[] = [
      [255, 0, 0], // Red
      [0, 255, 0], // Green
      [0, 0, 255], // Blue - closest
      [0, 0, 0] // Black
    ]

    const index = findClosestColorIndex(color, palette, euclideanDistance)
    expect(index).toBe(2) // Blue is closest
  })

  it('should find the closest color using weighted RGB distance', () => {
    const color: Vector = [100, 150, 50]
    const palette: Vector[] = [
      [255, 0, 0], // Red
      [0, 255, 0], // Green - closest (weighted)
      [0, 0, 255] // Blue
    ]

    const index = findClosestColorIndex(color, palette, weightedRGBDistance)
    expect(index).toBe(1) // Green is closest with weighted distance
  })

  it('should return 0 for single-color palette', () => {
    const color: Vector = [128, 64, 200]
    const palette: Vector[] = [[255, 0, 0]]

    const index = findClosestColorIndex(color, palette, euclideanDistance)
    expect(index).toBe(0)
  })

  it('should find exact match when color is in palette', () => {
    const color: Vector = [0, 255, 0]
    const palette: Vector[] = [
      [255, 0, 0],
      [0, 255, 0], // Exact match
      [0, 0, 255]
    ]

    const index = findClosestColorIndex(color, palette, euclideanDistance)
    expect(index).toBe(1)
  })

  it('should work with Float32Array colors', () => {
    const color = new Float32Array([0.5, 0.25, 0.75])
    const palette = [
      new Float32Array([1, 0, 0]),
      new Float32Array([0, 1, 0]),
      new Float32Array([0, 0, 1]) // Closest
    ]

    const index = findClosestColorIndex(color, palette, euclideanDistance)
    expect(index).toBe(2)
  })

  it('should throw error for empty palette', () => {
    const color: Vector = [128, 64, 200]
    const palette: Vector[] = []

    expect(() =>
      findClosestColorIndex(color, palette, euclideanDistance)
    ).toThrow('Palette cannot be empty')
  })

  it('should handle palette with identical colors', () => {
    const color: Vector = [100, 100, 100]
    const palette: Vector[] = [
      [128, 128, 128],
      [128, 128, 128],
      [128, 128, 128]
    ]

    const index = findClosestColorIndex(color, palette, euclideanDistance)
    expect(index).toBe(0) // Returns first match
  })
})
