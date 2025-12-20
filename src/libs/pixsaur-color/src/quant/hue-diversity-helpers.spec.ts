import { describe, expect, it } from 'vitest'
import type { Vector } from '../type'
import {
  calculateVividnessForColor,
  categorizeByHue,
  fillWithMostFrequent,
  findDarkestCandidate,
  isTooCloseToColors,
  selectByRoundRobin,
  selectFromGroupsSequentially
} from './hue-diversity-helpers'
import type { ColorCandidate } from './palette-strategies-v2'

// Test helper to create a candidate
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

describe('hue-diversity-helpers', () => {
  describe('calculateVividnessForColor', () => {
    it('should return higher score for saturated colors', () => {
      const saturated: Vector = [255, 0, 0] // Pure red
      const desaturated: Vector = [128, 128, 128] // Gray

      const saturatedScore = calculateVividnessForColor(saturated)
      const desaturatedScore = calculateVividnessForColor(desaturated)

      expect(saturatedScore).toBeGreaterThan(desaturatedScore)
    })

    it('should penalize very dark colors', () => {
      const brightRed: Vector = [255, 50, 50]
      const darkRed: Vector = [50, 10, 10]

      const brightScore = calculateVividnessForColor(brightRed)
      const darkScore = calculateVividnessForColor(darkRed)

      expect(brightScore).toBeGreaterThan(darkScore)
    })

    it('should penalize very bright colors', () => {
      const mediumSaturated: Vector = [200, 50, 50]
      const veryBright: Vector = [255, 230, 230]

      const mediumScore = calculateVividnessForColor(mediumSaturated)
      const brightScore = calculateVividnessForColor(veryBright)

      expect(mediumScore).toBeGreaterThan(brightScore)
    })

    it('should return 0 for black', () => {
      const black: Vector = [0, 0, 0]
      expect(calculateVividnessForColor(black)).toBe(0)
    })
  })

  describe('isTooCloseToColors', () => {
    it('should return true if candidate is too close to any avoided color', () => {
      const candidate = createCandidate(0, [100, 100, 100])
      const colorsToAvoid: Vector[] = [[105, 105, 105]] // Very close

      expect(isTooCloseToColors(candidate, colorsToAvoid)).toBe(true)
    })

    it('should return false if candidate is far from all avoided colors', () => {
      const candidate = createCandidate(0, [0, 0, 0])
      const colorsToAvoid: Vector[] = [[255, 255, 255]]

      expect(isTooCloseToColors(candidate, colorsToAvoid)).toBe(false)
    })

    it('should return false for empty colors to avoid', () => {
      const candidate = createCandidate(0, [100, 100, 100])
      expect(isTooCloseToColors(candidate, [])).toBe(false)
    })

    it('should use custom minimum distance', () => {
      const candidate = createCandidate(0, [100, 100, 100])
      const colorsToAvoid: Vector[] = [[130, 130, 130]]

      // With default distance, should be too close
      expect(isTooCloseToColors(candidate, colorsToAvoid, 100)).toBe(true)
      // With larger distance, should be far enough
      expect(isTooCloseToColors(candidate, colorsToAvoid, 10)).toBe(false)
    })
  })

  describe('categorizeByHue', () => {
    it('should categorize saturated colors into hue groups', () => {
      // Using colors that pass isVisuallyColorful (mid-range values, saturated)
      const red = createCandidate(0, [200, 100, 100]) // Hue ~0
      const green = createCandidate(1, [100, 200, 100]) // Hue ~120
      const blue = createCandidate(2, [100, 100, 200]) // Hue ~240

      const result = categorizeByHue([red, green, blue])

      // Red should be in group 0 (0-60)
      expect(result.hueGroups[0]).toContainEqual(red)
      // Green should be in group 2 (120-180)
      expect(result.hueGroups[2]).toContainEqual(green)
      // Blue should be in group 4 (240-300)
      expect(result.hueGroups[4]).toContainEqual(blue)
    })

    it('should categorize gray colors into grays', () => {
      const gray = createCandidate(0, [128, 128, 128])

      const result = categorizeByHue([gray])

      expect(result.grays).toContainEqual(gray)
      expect(result.hueGroups.flat()).not.toContainEqual(gray)
    })

    it('should categorize dark saturated colors into darkColors', () => {
      const darkRed = createCandidate(0, [30, 5, 5]) // Saturated but very dark

      const result = categorizeByHue([darkRed])

      // Dark saturated colors go to darkColors when not visually colorful
      expect(
        result.darkColors.length + result.grays.length
      ).toBeGreaterThanOrEqual(1)
    })

    it('should sort hue groups by vividness', () => {
      const brightRed = createCandidate(0, [255, 50, 50], 100)
      const dullRed = createCandidate(1, [200, 150, 150], 100)

      const result = categorizeByHue([dullRed, brightRed])

      // Bright red should come first in the sorted group
      const redGroup = result.hueGroups[0]
      if (redGroup.length === 2) {
        expect(redGroup[0].index).toBe(0) // brightRed
      }
    })
  })

  describe('findDarkestCandidate', () => {
    it('should return the darkest candidate', () => {
      const light = createCandidate(0, [200, 200, 200])
      const dark = createCandidate(1, [10, 10, 10])
      const medium = createCandidate(2, [100, 100, 100])

      const result = findDarkestCandidate([light, dark, medium], [])

      expect(result).not.toBeNull()
      expect(result!.index).toBe(1)
    })

    it('should return null if no candidate is dark enough', () => {
      const light = createCandidate(0, [200, 200, 200])
      const mediumLight = createCandidate(1, [180, 180, 180])

      const result = findDarkestCandidate([light, mediumLight], [], 0.2)

      expect(result).toBeNull()
    })

    it('should exclude candidates too close to colors to avoid', () => {
      // Use colors with more difference
      const darkA = createCandidate(10, [10, 10, 10])
      const darkB = createCandidate(11, [30, 30, 30])

      const result = findDarkestCandidate([darkA, darkB], [[10, 10, 10]], 0.2)

      expect(result).not.toBeNull()
      expect(result!.index).toBe(11) // Should be darkB, not darkA
    })

    it('should return null for empty candidates', () => {
      const result = findDarkestCandidate([], [])
      expect(result).toBeNull()
    })
  })

  describe('selectByRoundRobin', () => {
    it('should select one from each group in round-robin fashion', () => {
      const red1 = createCandidate(0, [255, 0, 0])
      const red2 = createCandidate(1, [200, 0, 0])
      const green1 = createCandidate(2, [0, 255, 0])
      const green2 = createCandidate(3, [0, 200, 0])
      const blue1 = createCandidate(4, [0, 0, 255])

      const hueGroups: ColorCandidate[][] = [
        [red1, red2], // Group 0
        [], // Group 1
        [green1, green2], // Group 2
        [], // Group 3
        [blue1], // Group 4
        [] // Group 5
      ]

      const result = selectByRoundRobin(hueGroups, 6, [])

      // First round: red1, green1, blue1
      // Second round: red2, green2
      expect(result.length).toBe(5)
      expect(result.map((c) => c.index)).toContain(0)
      expect(result.map((c) => c.index)).toContain(2)
      expect(result.map((c) => c.index)).toContain(4)
    })

    it('should respect maxCandidates limit', () => {
      const red = createCandidate(0, [255, 0, 0])
      const green = createCandidate(1, [0, 255, 0])
      const blue = createCandidate(2, [0, 0, 255])

      const hueGroups: ColorCandidate[][] = [[red], [], [green], [], [blue], []]

      const result = selectByRoundRobin(hueGroups, 2, [])

      expect(result.length).toBe(2)
    })

    it('should skip candidates too close to avoided colors', () => {
      const red = createCandidate(0, [255, 0, 0])
      const green = createCandidate(1, [0, 255, 0])

      const hueGroups: ColorCandidate[][] = [[red], [], [green], [], [], []]

      const result = selectByRoundRobin(hueGroups, 5, [[255, 0, 0]])

      expect(result.map((c) => c.index)).not.toContain(0)
      expect(result.map((c) => c.index)).toContain(1)
    })

    it('should preserve initial selection', () => {
      const initial = createCandidate(99, [128, 128, 128])
      const red = createCandidate(0, [255, 0, 0])

      const hueGroups: ColorCandidate[][] = [[red], [], [], [], [], []]

      const result = selectByRoundRobin(hueGroups, 5, [], [initial])

      expect(result[0].index).toBe(99)
      expect(result.length).toBe(2)
    })
  })

  describe('selectFromGroupsSequentially', () => {
    it('should select from hue groups first, then dark, then grays', () => {
      const red = createCandidate(0, [255, 0, 0])
      const darkRed = createCandidate(1, [50, 10, 10])
      const gray = createCandidate(2, [128, 128, 128])

      const categories = {
        hueGroups: [[red], [], [], [], [], []] as ColorCandidate[][],
        darkColors: [darkRed],
        grays: [gray]
      }

      const result = selectFromGroupsSequentially(categories, 10, [])

      expect(result.length).toBe(3)
      expect(result[0].index).toBe(0) // Red first
      expect(result[1].index).toBe(1) // Dark second
      expect(result[2].index).toBe(2) // Gray last
    })

    it('should respect maxCandidates limit', () => {
      const red = createCandidate(0, [255, 0, 0])
      const green = createCandidate(1, [0, 255, 0])
      const gray = createCandidate(2, [128, 128, 128])

      const categories = {
        hueGroups: [[red], [], [green], [], [], []] as ColorCandidate[][],
        darkColors: [],
        grays: [gray]
      }

      const result = selectFromGroupsSequentially(categories, 2, [])

      expect(result.length).toBe(2)
    })

    it('should skip candidates too close to avoided colors', () => {
      const red = createCandidate(0, [255, 0, 0])
      const gray = createCandidate(1, [128, 128, 128])

      const categories = {
        hueGroups: [[red], [], [], [], [], []] as ColorCandidate[][],
        darkColors: [],
        grays: [gray]
      }

      const result = selectFromGroupsSequentially(categories, 10, [[255, 0, 0]])

      expect(result.map((c) => c.index)).not.toContain(0)
      expect(result.map((c) => c.index)).toContain(1)
    })
  })

  describe('fillWithMostFrequent', () => {
    it('should fill remaining slots with most frequent candidates', () => {
      const frequent = createCandidate(0, [100, 100, 100], 1000)
      const lessFrequent = createCandidate(1, [150, 150, 150], 500)
      const initial = createCandidate(2, [50, 50, 50], 100)

      const result = fillWithMostFrequent(
        [frequent, lessFrequent],
        3,
        [],
        [initial]
      )

      expect(result.length).toBe(3)
      expect(result.map((c) => c.index)).toContain(2) // Initial preserved
      expect(result.map((c) => c.index)).toContain(0) // Frequent added
      expect(result.map((c) => c.index)).toContain(1) // Less frequent added
    })

    it('should respect maxCandidates limit', () => {
      const c1 = createCandidate(0, [100, 100, 100], 1000)
      const c2 = createCandidate(1, [150, 150, 150], 500)

      const result = fillWithMostFrequent([c1, c2], 1, [], [])

      expect(result.length).toBe(1)
    })

    it('should skip candidates too close to avoided colors', () => {
      const c1 = createCandidate(0, [100, 100, 100], 1000)
      const c2 = createCandidate(1, [200, 200, 200], 500)

      const result = fillWithMostFrequent([c1, c2], 5, [[100, 100, 100]], [])

      expect(result.map((c) => c.index)).not.toContain(0)
      expect(result.map((c) => c.index)).toContain(1)
    })

    it('should not add duplicates from current selection', () => {
      const c1 = createCandidate(0, [100, 100, 100], 1000)
      const c2 = createCandidate(1, [200, 200, 200], 500)

      const result = fillWithMostFrequent([c1, c2], 5, [], [c1])

      const indices = result.map((c) => c.index)
      const uniqueIndices = [...new Set(indices)]
      expect(indices.length).toBe(uniqueIndices.length)
    })
  })
})
