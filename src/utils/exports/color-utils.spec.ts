import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { findDarkestColor } from './color-utils'

describe('findDarkestColor', () => {
  it('should find the darkest color in a palette', () => {
    const palette: Vector[] = [
      [255, 255, 255], // White - brightest
      [128, 128, 128], // Gray - middle
      [0, 0, 0], // Black - darkest
      [255, 0, 0] // Red - bright
    ]

    const darkest = findDarkestColor(palette)
    expect(darkest).toEqual([0, 0, 0])
  })

  it('should handle palette with only one color', () => {
    const palette: Vector[] = [[100, 150, 200]]
    const darkest = findDarkestColor(palette)
    expect(darkest).toEqual([100, 150, 200])
  })

  it('should find darkest among similar colors', () => {
    const palette: Vector[] = [
      [10, 10, 10], // Darker
      [20, 20, 20], // Lighter
      [5, 5, 5], // Darkest
      [15, 15, 15] // Medium
    ]

    const darkest = findDarkestColor(palette)
    expect(darkest).toEqual([5, 5, 5])
  })

  it('should throw error for empty palette', () => {
    expect(() => findDarkestColor([])).toThrow('Palette cannot be empty')
  })

  it('should handle CPC colors correctly', () => {
    const palette: Vector[] = [
      [255, 255, 255], // White
      [128, 128, 128], // Gray
      [0, 128, 255], // Light blue
      [0, 0, 0], // Black - should be darkest
      [255, 0, 0] // Red
    ]

    const darkest = findDarkestColor(palette)
    expect(darkest).toEqual([0, 0, 0])
  })
})
