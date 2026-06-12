import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  filterByDistance,
  filterIgnored,
  truncatePalette
} from './palette-filtering'

describe('filterByDistance', () => {
  it('returns the palette unchanged when there are no reference colors', () => {
    const palette: Vector[] = [
      [0, 0, 0],
      [255, 255, 255]
    ]
    expect(filterByDistance(palette, [])).toBe(palette)
  })

  it('drops colors too close to a reference color', () => {
    const palette: Vector[] = [
      [0, 0, 0],
      [255, 255, 255]
    ]
    expect(filterByDistance(palette, [[0, 0, 0]])).toEqual([[255, 255, 255]])
  })

  it('keeps colors that are far from every reference (custom threshold)', () => {
    const palette: Vector[] = [
      [10, 10, 10],
      [250, 250, 250]
    ]
    expect(filterByDistance(palette, [[0, 0, 0]], 5)).toEqual([
      [10, 10, 10],
      [250, 250, 250]
    ])
  })
})

describe('filterIgnored', () => {
  it('removes the default [-1,-1,-1] markers', () => {
    const palette: Vector[] = [
      [10, 20, 30],
      [-1, -1, -1],
      [40, 50, 60]
    ]
    expect(filterIgnored(palette)).toEqual([
      [10, 20, 30],
      [40, 50, 60]
    ])
  })

  it('supports a custom ignored marker', () => {
    const palette: Vector[] = [
      [0, 0, 0],
      [99, 99, 99]
    ]
    expect(filterIgnored(palette, [99, 99, 99])).toEqual([[0, 0, 0]])
  })

  it('keeps colors that only partially match the marker', () => {
    const palette: Vector[] = [[-1, -1, 0]]
    expect(filterIgnored(palette)).toEqual([[-1, -1, 0]])
  })
})

describe('truncatePalette', () => {
  it('keeps the first N colors', () => {
    const palette: Vector[] = [
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3]
    ]
    expect(truncatePalette(palette, 2)).toEqual([
      [1, 1, 1],
      [2, 2, 2]
    ])
  })

  it('returns everything when N exceeds the length', () => {
    const palette: Vector[] = [[1, 1, 1]]
    expect(truncatePalette(palette, 10)).toEqual([[1, 1, 1]])
  })

  it('returns an empty palette for N=0', () => {
    expect(truncatePalette([[1, 1, 1]], 0)).toEqual([])
  })
})
