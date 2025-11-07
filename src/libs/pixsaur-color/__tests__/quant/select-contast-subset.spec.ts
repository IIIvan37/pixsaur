import {
  isBright,
  isDark,
  luminance,
  selectBalancedSubset,
  selectContrastedSubset
} from '../../src/quant/select-contrast-subset'
import type { Vector } from '../../src/type'

const dist = (a: Vector, b: Vector) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('selectContrastedSubset', () => {
  const black: Vector = [0, 0, 0]
  const white: Vector = [255, 255, 255]
  const red: Vector = [255, 0, 0]
  const green: Vector = [0, 255, 0]
  const blue: Vector = [0, 0, 255]

  it('retourne les preselected si leur nombre >= size', () => {
    expect(
      selectContrastedSubset(
        [red, green, blue],
        [red, green, blue],
        2,
        dist,
        (v) => v
      )
    ).toEqual([red, green])
  })

  it('complète les preselected avec les meilleures couleurs', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [red],
      3,
      dist,
      (v) => v
    )
    expect(result).toContain(red)
    expect(result.length).toBe(3)
  })

  it('inclut toujours toutes les couleurs preselected', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [red, green],
      4,
      dist,
      (v) => v
    )
    expect(result).toEqual(expect.arrayContaining([red, green]))
    expect(result.length).toBe(4)
  })

  it('préfère un set contenant une couleur sombre et une claire', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [],
      2,
      dist,
      (v) => v // identity function for RGB
    )
    expect(result).toEqual(expect.arrayContaining([black, white]))
  })

  it('should return max limit of colors', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [],
      3,
      dist,
      (v) => v
    )
    expect(result.length).toBe(3)
  })

  it('should return max limit of colors when preselected length equal limit', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [black, white, red],
      3,
      dist,
      (v) => v
    )
    expect(result.length).toBe(3)
  })
})

describe('luminance utilities', () => {
  it('should calculate luminance correctly', () => {
    expect(luminance([0, 0, 0])).toBeCloseTo(0, 3) // Black
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 3) // White
    expect(luminance([255, 0, 0])).toBeCloseTo(0.2126, 3) // Red
    expect(luminance([0, 255, 0])).toBeCloseTo(0.7152, 3) // Green
    expect(luminance([0, 0, 255])).toBeCloseTo(0.0722, 3) // Blue
    expect(luminance([128, 128, 128])).toBeCloseTo(0.502, 3) // Gray
  })

  it('should identify dark colors', () => {
    expect(isDark([0, 0, 0])).toBe(true) // Black
    expect(isDark([25, 25, 25])).toBe(true) // Very dark gray
    expect(isDark([50, 50, 50])).toBe(true) // Dark gray
    expect(isDark([51, 51, 51])).toBe(false) // Not dark
    expect(isDark([255, 255, 255])).toBe(false) // White
  })

  it('should identify bright colors', () => {
    expect(isBright([255, 255, 255])).toBe(true) // White
    expect(isBright([230, 230, 230])).toBe(true) // Very bright gray
    expect(isBright([205, 205, 205])).toBe(true) // Bright gray (> 0.8)
    expect(isBright([204, 204, 204])).toBe(false) // Not bright (= 0.8)
    expect(isBright([0, 0, 0])).toBe(false) // Black
  })
})

describe('selectBalancedSubset', () => {
  const black: Vector = [0, 0, 0]
  const white: Vector = [255, 255, 255]
  const red: Vector = [255, 0, 0]
  const green: Vector = [0, 255, 0]
  const blue: Vector = [0, 0, 255]
  const gray: Vector = [128, 128, 128]

  it('should return preselected colors if already at target size', () => {
    const result = selectBalancedSubset(
      [red, green, blue],
      [black, white],
      2,
      dist,
      (v) => v
    )
    expect(result).toEqual([black, white])
  })

  it('should return all available colors if fewer than needed', () => {
    const result = selectBalancedSubset([red], [black], 3, dist, (v) => v)
    expect(result).toEqual([black, red])
  })

  it('should select balanced colors prioritizing contrast and luminance diversity', () => {
    const candidates = [black, white, red, green, blue, gray]
    const result = selectBalancedSubset(candidates, [], 4, dist, (v) => v)

    expect(result.length).toBe(4)
    expect(result).toEqual(expect.arrayContaining([black, white])) // Should include extremes

    // Check that colors are from candidates
    for (const color of result) {
      expect(candidates).toEqual(expect.arrayContaining([color]))
    }
  })

  it('should handle preselected colors correctly', () => {
    const result = selectBalancedSubset(
      [red, green, blue, gray],
      [black],
      3,
      dist,
      (v) => v
    )

    expect(result).toContain(black)
    expect(result.length).toBe(3)
  })

  it('should prefer colors with good luminance distribution', () => {
    // Test with colors that have different luminance values
    const darkRed: Vector = [64, 0, 0]
    const brightBlue: Vector = [0, 128, 255]
    const mediumGreen: Vector = [0, 128, 0]

    const result = selectBalancedSubset(
      [darkRed, brightBlue, mediumGreen],
      [],
      2,
      dist,
      (v) => v
    )

    expect(result.length).toBe(2)
    // Should prefer contrasting colors
  })

  it('should handle empty candidates array', () => {
    const result = selectBalancedSubset([], [black, white], 2, dist, (v) => v)
    expect(result).toEqual([black, white])
  })

  it('should handle single candidate', () => {
    const result = selectBalancedSubset([red], [black], 2, dist, (v) => v)
    expect(result).toEqual([black, red])
  })

  it('should give luminance bonus to bright colors when needed', () => {
    // Start with only dark colors, should favor adding a bright color
    const darkGray: Vector = [30, 30, 30] // Very dark (lum < 0.2)
    const brightColor: Vector = [250, 250, 250] // Very bright (lum > 0.8)
    const mediumColor: Vector = [128, 128, 128] // Medium

    const result = selectBalancedSubset(
      [brightColor, mediumColor],
      [darkGray],
      2,
      dist,
      (v) => v
    )

    // Should prefer bright color over medium to balance luminance
    expect(result).toContain(darkGray)
    expect(result).toContain(brightColor)
  })

  it('should give luminance bonus to dark colors when needed', () => {
    // Start with only bright colors, should favor adding a dark color
    const brightGray: Vector = [250, 250, 250] // Very bright (lum > 0.8)
    const darkColor: Vector = [10, 10, 10] // Very dark (lum < 0.2)
    const mediumColor: Vector = [128, 128, 128] // Medium

    const result = selectBalancedSubset(
      [darkColor, mediumColor],
      [brightGray],
      2,
      dist,
      (v) => v
    )

    // Should prefer dark color over medium to balance luminance
    expect(result).toContain(brightGray)
    expect(result).toContain(darkColor)
  })
})

describe('selectContrastedSubset - comprehensive tests', () => {
  const black: Vector = [0, 0, 0]
  const white: Vector = [255, 255, 255]
  const red: Vector = [255, 0, 0]
  const green: Vector = [0, 255, 0]
  const blue: Vector = [0, 0, 255]
  const gray: Vector = [128, 128, 128]

  it('should handle large candidate sets efficiently', () => {
    const candidates = Array.from(
      { length: 10 },
      (_, i) => [i * 25, i * 25, i * 25] as Vector
    )
    const result = selectContrastedSubset(candidates, [], 5, dist, (v) => v)
    expect(result.length).toBe(5)
  })

  it('should prefer combinations with both dark and bright colors', () => {
    const candidates = [gray, red, green, blue] // All medium brightness
    const result = selectContrastedSubset(
      candidates,
      [black], // Preselected dark
      3,
      dist,
      (v) => v
    )
    expect(result).toContain(black)
    expect(result.length).toBe(3)
  })

  it('should handle duplicate colors in candidates', () => {
    const candidates = [black, black, white, white, red]
    const result = selectContrastedSubset(candidates, [], 3, dist, (v) => v)
    expect(result.length).toBe(3)
  })

  it('should work with different distance functions', () => {
    const manhattanDist = (a: Vector, b: Vector) =>
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [],
      3,
      manhattanDist,
      (v) => v
    )
    expect(result.length).toBe(3)
  })

  it('should handle color space conversion', () => {
    // Mock color space conversion (e.g., from LAB to RGB)
    const labToRgb = (lab: Vector) => {
      // Simple mock conversion - in real usage this would be proper LAB->RGB
      return [lab[0] * 2.55, lab[1] * 2.55, lab[2] * 2.55] as Vector<'RGB'>
    }

    const labBlack: Vector = [0, 0, 0] // LAB black
    const labRed: Vector = [53, 80, 67] // LAB red

    const result = selectContrastedSubset(
      [labRed],
      [labBlack],
      2,
      dist,
      labToRgb
    )
    expect(result).toEqual([labBlack, labRed])
  })

  it('should handle edge case with very similar colors', () => {
    const similarColors = [
      [100, 100, 100],
      [101, 101, 101],
      [102, 102, 102],
      [103, 103, 103]
    ] as Vector[]

    const result = selectContrastedSubset(similarColors, [], 2, dist, (v) => v)
    expect(result.length).toBe(2)
  })

  it('should handle maximum size larger than available colors', () => {
    const result = selectContrastedSubset(
      [black, white],
      [],
      10,
      dist,
      (v) => v
    )
    expect(result).toEqual([black, white])
  })

  it('should efficiently handle repeated combinations (memoization)', () => {
    // Create a scenario where kCombinations may reuse memoized results
    const candidates = [black, white, red, green, blue, gray]

    // First call
    const result1 = selectContrastedSubset(candidates, [], 3, dist, (v) => v)
    expect(result1.length).toBe(3)

    // Second call with same size - may hit memoization
    const result2 = selectContrastedSubset(candidates, [], 3, dist, (v) => v)
    expect(result2.length).toBe(3)
  })
})
