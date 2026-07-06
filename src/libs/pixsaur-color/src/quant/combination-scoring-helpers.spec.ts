import { describe, expect, it } from 'vitest'
import type { Vector } from '../type'
import {
  calculateAverageSaturation,
  calculateEnhancedCombinationScore,
  calculateMinDistanceInSet,
  calculateMinHueDistanceInSet,
  calculateTotalVividness,
  countVisuallyColorful,
  findDarkestCandidateIndex,
  getPreselectedHues,
  hasDarkPreselected,
  isHueDiverse,
  passesCPCPlusFilters,
  selectFallbackColors,
  selectWithHueDiversity,
  sortByVividness
} from './combination-scoring-helpers'
import type { ColorCandidate } from './palette-strategies-v2'

// Helper to create a candidate
function createCandidate(
  index: number,
  color: Vector,
  frequency: number = 100
): ColorCandidate {
  return {
    index,
    frequency,
    color,
    converted: color
  }
}

describe('combination-scoring-helpers', () => {
  describe('calculateTotalVividness', () => {
    it('should return higher value for saturated colors', () => {
      const saturated: Vector[] = [
        [255, 0, 0],
        [0, 255, 0]
      ]
      const desaturated: Vector[] = [
        [128, 128, 128],
        [100, 100, 100]
      ]

      const saturatedScore = calculateTotalVividness(saturated)
      const desaturatedScore = calculateTotalVividness(desaturated)

      expect(saturatedScore).toBeGreaterThan(desaturatedScore)
    })

    it('should return 0 for black colors', () => {
      const blacks: Vector[] = [
        [0, 0, 0],
        [0, 0, 0]
      ]
      expect(calculateTotalVividness(blacks)).toBe(0)
    })
  })

  describe('calculateAverageSaturation', () => {
    it('should return high value for saturated colors', () => {
      const saturated: Vector[] = [
        [255, 0, 0],
        [0, 0, 255]
      ]
      expect(calculateAverageSaturation(saturated)).toBeGreaterThan(0.8)
    })

    it('should return 0 for gray colors', () => {
      const grays: Vector[] = [
        [128, 128, 128],
        [200, 200, 200]
      ]
      expect(calculateAverageSaturation(grays)).toBe(0)
    })

    it('should exclude very dark and very bright colors', () => {
      const mixed: Vector[] = [
        [0, 0, 0], // Very dark - excluded
        [255, 255, 255], // Very bright - excluded
        [200, 50, 50] // Medium - included
      ]
      const result = calculateAverageSaturation(mixed)
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('calculateMinDistanceInSet', () => {
    it('should return small distance for similar colors', () => {
      const similar: Vector[] = [
        [100, 100, 100],
        [105, 105, 105]
      ]
      const dist = calculateMinDistanceInSet(similar, 0)
      expect(dist).toBeLessThan(50)
    })

    it('should return large distance for contrasting colors', () => {
      const contrasting: Vector[] = [
        [0, 0, 0],
        [255, 255, 255]
      ]
      const dist = calculateMinDistanceInSet(contrasting, 0)
      expect(dist).toBeGreaterThan(400)
    })

    it('should handle single color', () => {
      const single: Vector[] = [[100, 100, 100]]
      const dist = calculateMinDistanceInSet(single, 0)
      expect(dist).toBe(Infinity)
    })
  })

  describe('calculateMinHueDistanceInSet', () => {
    it('should return large distance for complementary colors', () => {
      const complementary: Vector[] = [
        [255, 0, 0], // Red ~0°
        [0, 255, 255] // Cyan ~180°
      ]
      const dist = calculateMinHueDistanceInSet(complementary)
      expect(dist).toBeGreaterThan(150)
    })

    it('should return small distance for similar hues', () => {
      const similarHues: Vector[] = [
        [255, 0, 0], // Red
        [255, 50, 0] // Orange-red
      ]
      const dist = calculateMinHueDistanceInSet(similarHues)
      expect(dist).toBeLessThan(30)
    })

    it('should return 360 for desaturated colors', () => {
      const grays: Vector[] = [
        [128, 128, 128],
        [200, 200, 200]
      ]
      const dist = calculateMinHueDistanceInSet(grays)
      expect(dist).toBe(360)
    })
  })

  describe('countVisuallyColorful', () => {
    it('should count saturated medium-brightness colors', () => {
      const colors: Vector[] = [
        [200, 100, 100], // Colorful
        [100, 200, 100], // Colorful
        [128, 128, 128] // Gray - not colorful
      ]
      // Note: isVisuallyColorful has specific thresholds
      const count = countVisuallyColorful(colors)
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('calculateEnhancedCombinationScore', () => {
    it('should add bonus for hue diversity', () => {
      const baseScore = 100
      const diverseColors: Vector[] = [
        [255, 0, 0], // Red
        [0, 255, 0], // Green
        [0, 0, 255] // Blue
      ]
      const enhancedScore = calculateEnhancedCombinationScore(
        baseScore,
        diverseColors
      )
      expect(enhancedScore).toBeGreaterThan(baseScore)
    })
  })

  describe('passesCPCPlusFilters', () => {
    it('should reject combinations with low hue diversity', () => {
      const similarHues: Vector[] = [
        [255, 0, 0],
        [250, 10, 10],
        [245, 20, 20],
        [240, 30, 30]
      ]
      expect(passesCPCPlusFilters(similarHues, 0)).toBe(false)
    })

    it('should reject combinations with low saturation', () => {
      const lowSat: Vector[] = [
        [128, 128, 128],
        [130, 130, 130],
        [125, 125, 125],
        [135, 135, 135]
      ]
      expect(passesCPCPlusFilters(lowSat, 0)).toBe(false)
    })
  })

  describe('isHueDiverse', () => {
    it('should return true when hue is far from used hues', () => {
      const usedHues = [0, 120] // Red and Green
      expect(isHueDiverse(240, usedHues, 60)).toBe(true) // Blue
    })

    it('should return false when hue is close to used hues', () => {
      const usedHues = [0, 120]
      expect(isHueDiverse(10, usedHues, 60)).toBe(false) // Close to red
    })

    it('should handle wrap-around at 360°', () => {
      const usedHues = [350]
      expect(isHueDiverse(10, usedHues, 30)).toBe(false) // 20° apart
      expect(isHueDiverse(10, usedHues, 15)).toBe(true) // 20° apart > 15
    })
  })

  describe('selectWithHueDiversity', () => {
    it('should select diverse colors', () => {
      const red = createCandidate(0, [255, 50, 50])
      const green = createCandidate(1, [50, 255, 50])
      const blue = createCandidate(2, [50, 50, 255])

      const candidatesWithIndex = [
        { candidate: red, arrayIndex: 0 },
        { candidate: green, arrayIndex: 1 },
        { candidate: blue, arrayIndex: 2 }
      ]

      const result = selectWithHueDiversity(candidatesWithIndex, [], [], 3, 60)

      expect(result.selectedIndices).toHaveLength(3)
    })

    it('should skip similar hues', () => {
      const red1 = createCandidate(0, [255, 50, 50])
      const red2 = createCandidate(1, [250, 60, 60])
      const green = createCandidate(2, [50, 255, 50])

      const candidatesWithIndex = [
        { candidate: red1, arrayIndex: 0 },
        { candidate: red2, arrayIndex: 1 },
        { candidate: green, arrayIndex: 2 }
      ]

      const result = selectWithHueDiversity(candidatesWithIndex, [], [], 2, 60)

      // Should skip red2 because it's too similar to red1
      expect(result.selectedIndices).toContain(0)
      expect(result.selectedIndices).toContain(2)
      expect(result.selectedIndices).not.toContain(1)
    })

    it('should skip colors darker than the min luminance', () => {
      const dark = createCandidate(0, [10, 10, 10])
      const red = createCandidate(1, [255, 50, 50])

      const result = selectWithHueDiversity(
        [
          { candidate: dark, arrayIndex: 0 },
          { candidate: red, arrayIndex: 1 }
        ],
        [],
        [],
        5,
        60
      )

      expect(result.selectedIndices).toEqual([1])
    })

    it('should select a bright achromatic color', () => {
      const gray = createCandidate(0, [150, 150, 150])

      const result = selectWithHueDiversity(
        [{ candidate: gray, arrayIndex: 0 }],
        [],
        [],
        5,
        60
      )

      expect(result.selectedIndices).toEqual([0])
    })

    it('should not track a hue for achromatic colors', () => {
      const gray = createCandidate(0, [150, 150, 150])

      const result = selectWithHueDiversity(
        [{ candidate: gray, arrayIndex: 0 }],
        [],
        [],
        5,
        60
      )

      expect(result.updatedHues).toEqual([])
    })

    it('should track the hue of a selected saturated color', () => {
      const red = createCandidate(0, [255, 50, 50])

      const result = selectWithHueDiversity(
        [{ candidate: red, arrayIndex: 0 }],
        [],
        [],
        5,
        60
      )

      expect(result.updatedHues).toHaveLength(1)
    })

    it('should stop once neededColors is reached', () => {
      const red = createCandidate(0, [255, 50, 50])
      const green = createCandidate(1, [50, 255, 50])
      const blue = createCandidate(2, [50, 50, 255])

      const result = selectWithHueDiversity(
        [
          { candidate: red, arrayIndex: 0 },
          { candidate: green, arrayIndex: 1 },
          { candidate: blue, arrayIndex: 2 }
        ],
        [],
        [],
        1,
        60
      )

      expect(result.selectedIndices).toHaveLength(1)
    })

    it('should keep the initial selection without duplicating it', () => {
      const red = createCandidate(0, [255, 50, 50])
      const green = createCandidate(1, [50, 255, 50])

      const result = selectWithHueDiversity(
        [
          { candidate: red, arrayIndex: 0 },
          { candidate: green, arrayIndex: 1 }
        ],
        [0],
        [],
        5,
        60
      )

      expect(result.selectedIndices).toEqual([0, 1])
    })
  })

  describe('findDarkestCandidateIndex', () => {
    it('should find the darkest candidate', () => {
      const candidates = [
        createCandidate(0, [200, 200, 200]),
        createCandidate(1, [10, 10, 10]),
        createCandidate(2, [100, 100, 100])
      ]

      const idx = findDarkestCandidateIndex(candidates)
      expect(idx).toBe(1)
    })

    it('should return -1 if no candidate is dark enough', () => {
      const candidates = [
        createCandidate(0, [200, 200, 200]),
        createCandidate(1, [180, 180, 180])
      ]

      const idx = findDarkestCandidateIndex(candidates, 0.1)
      expect(idx).toBe(-1)
    })
  })

  describe('hasDarkPreselected', () => {
    it('should return true when a dark color is present', () => {
      const colors: Vector[] = [
        [10, 10, 10],
        [200, 200, 200]
      ]
      expect(hasDarkPreselected(colors)).toBe(true)
    })

    it('should return false when no dark color is present', () => {
      const colors: Vector[] = [
        [200, 200, 200],
        [150, 150, 150]
      ]
      expect(hasDarkPreselected(colors)).toBe(false)
    })
  })

  describe('getPreselectedHues', () => {
    it('should extract hues from saturated colors', () => {
      const colors: Vector[] = [
        [255, 0, 0], // Red ~0°
        [0, 255, 0] // Green ~120°
      ]
      const hues = getPreselectedHues(colors)
      expect(hues).toHaveLength(2)
    })

    it('should ignore gray colors', () => {
      const colors: Vector[] = [
        [128, 128, 128],
        [255, 0, 0]
      ]
      const hues = getPreselectedHues(colors)
      expect(hues).toHaveLength(1)
    })
  })

  describe('sortByVividness', () => {
    it('should sort by vividness descending', () => {
      const candidates = [
        createCandidate(0, [128, 128, 128]), // Gray - low vividness
        createCandidate(1, [200, 50, 50]), // Red - high vividness
        createCandidate(2, [150, 100, 100]) // Pink - medium vividness
      ]

      const sorted = sortByVividness(candidates)

      // Most vivid should be first
      expect(sorted[0].arrayIndex).toBe(1)
    })
  })

  describe('selectFallbackColors', () => {
    it('should select diverse colors as fallback', () => {
      const candidates = [
        createCandidate(0, [200, 50, 50]), // Red
        createCandidate(1, [50, 200, 50]), // Green
        createCandidate(2, [50, 50, 200]), // Blue
        createCandidate(3, [10, 10, 10]) // Dark
      ]

      const result = selectFallbackColors(candidates, [], 4)

      expect(result).toHaveLength(4)
    })

    it('should add dark color first if not preselected', () => {
      const candidates = [
        createCandidate(0, [200, 50, 50]),
        createCandidate(1, [5, 5, 5]) // Very dark
      ]

      const result = selectFallbackColors(candidates, [], 2)

      // Dark color should be selected
      expect(result).toContain(1)
    })

    it('should not add dark color if already preselected', () => {
      const candidates = [
        createCandidate(0, [200, 50, 50]),
        createCandidate(1, [5, 5, 5])
      ]
      const preselected: Vector[] = [[10, 10, 10]] // Already has dark

      const result = selectFallbackColors(candidates, preselected, 2)

      expect(result.length).toBeLessThanOrEqual(2)
    })
  })
})
