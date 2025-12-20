/**
 * Tests for color-selection-helpers.ts
 *
 * These tests cover the functionality before SonarQube fixes to ensure
 * no regressions are introduced.
 */

import { describe, expect, it, vi } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  addBucketRepresentativesWithDistanceCheck,
  type ColorFrequencyItem,
  CPC_MODE_1_MAX_COLORS,
  calculateHue,
  calculateHueDistance,
  calculateSaturation,
  calculateValue,
  createHueBuckets,
  DELTA_MIN_FOR_HUE,
  getMinRGBDistance,
  HUE_BUCKET_SIZE_DEGREES,
  type HueBucket,
  isMode0,
  MIN_HUE_DISTANCE_MODE_0,
  MIN_RGB_DISTANCE_MODE_0,
  MIN_RGB_DISTANCE_MODE_1_2,
  SATURATION_THRESHOLD_FOR_HUE,
  selectBucketRepresentatives,
  selectBucketRepresentativesWithLightness,
  selectFrequentColorsWithDiversity,
  selectMaxMinDistanceColors,
  sortBucketsByFrequency
} from './color-selection-helpers'

// Mock the logger to avoid console output during tests
vi.mock('@/core', () => ({
  adapterLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('color-selection-helpers', () => {
  // ============================================================================
  // Constants exports
  // ============================================================================
  describe('constants', () => {
    it('should export CPC_MODE_1_MAX_COLORS as 4', () => {
      expect(CPC_MODE_1_MAX_COLORS).toBe(4)
    })

    it('should export MIN_RGB_DISTANCE_MODE_0 as 100', () => {
      expect(MIN_RGB_DISTANCE_MODE_0).toBe(100)
    })

    it('should export MIN_RGB_DISTANCE_MODE_1_2 as 200', () => {
      expect(MIN_RGB_DISTANCE_MODE_1_2).toBe(200)
    })

    it('should export MIN_HUE_DISTANCE_MODE_0 as 35', () => {
      expect(MIN_HUE_DISTANCE_MODE_0).toBe(35)
    })

    it('should export SATURATION_THRESHOLD_FOR_HUE as 0.2', () => {
      expect(SATURATION_THRESHOLD_FOR_HUE).toBe(0.2)
    })

    it('should export DELTA_MIN_FOR_HUE as 0.01', () => {
      expect(DELTA_MIN_FOR_HUE).toBe(0.01)
    })

    it('should export HUE_BUCKET_SIZE_DEGREES as 45', () => {
      expect(HUE_BUCKET_SIZE_DEGREES).toBe(45)
    })
  })

  // ============================================================================
  // Re-exported HSV functions
  // ============================================================================
  describe('re-exported HSV functions', () => {
    it('should export calculateHue function', () => {
      expect(typeof calculateHue).toBe('function')
      // Red has hue around 0
      const red: Vector = [255, 0, 0]
      const hue = calculateHue(red, DELTA_MIN_FOR_HUE)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(30) // Red is around 0°
    })

    it('should export calculateHueDistance function', () => {
      expect(typeof calculateHueDistance).toBe('function')
      // Opposite hues should have max distance (180)
      expect(calculateHueDistance(0, 180)).toBe(180)
      expect(calculateHueDistance(90, 270)).toBe(180)
      // Adjacent hues should have small distance
      expect(calculateHueDistance(0, 30)).toBe(30)
    })

    it('should export calculateSaturation function', () => {
      expect(typeof calculateSaturation).toBe('function')
      // Pure red is fully saturated
      const red: Vector = [255, 0, 0]
      expect(calculateSaturation(red)).toBe(1)
      // Gray is desaturated
      const gray: Vector = [128, 128, 128]
      expect(calculateSaturation(gray)).toBe(0)
    })

    it('should export calculateValue function', () => {
      expect(typeof calculateValue).toBe('function')
      // White has max value
      const white: Vector = [255, 255, 255]
      expect(calculateValue(white)).toBe(1)
      // Black has min value
      const black: Vector = [0, 0, 0]
      expect(calculateValue(black)).toBe(0)
    })
  })

  // ============================================================================
  // isMode0
  // ============================================================================
  describe('isMode0', () => {
    it('should return true for targetColors > 4', () => {
      expect(isMode0(5)).toBe(true)
      expect(isMode0(16)).toBe(true)
    })

    it('should return false for targetColors <= 4', () => {
      expect(isMode0(4)).toBe(false)
      expect(isMode0(2)).toBe(false)
      expect(isMode0(1)).toBe(false)
    })
  })

  // ============================================================================
  // getMinRGBDistance
  // ============================================================================
  describe('getMinRGBDistance', () => {
    it('should return MIN_RGB_DISTANCE_MODE_1_2 for mode 1-2', () => {
      expect(getMinRGBDistance(4)).toBe(MIN_RGB_DISTANCE_MODE_1_2)
      expect(getMinRGBDistance(2)).toBe(MIN_RGB_DISTANCE_MODE_1_2)
    })

    it('should return MIN_RGB_DISTANCE_MODE_0 for mode 0', () => {
      expect(getMinRGBDistance(5)).toBe(MIN_RGB_DISTANCE_MODE_0)
      expect(getMinRGBDistance(16)).toBe(MIN_RGB_DISTANCE_MODE_0)
    })
  })

  // ============================================================================
  // createHueBuckets
  // ============================================================================
  describe('createHueBuckets', () => {
    const createColorItem = (
      index: number,
      color: Vector,
      frequency = 0.1
    ): ColorFrequencyItem => ({
      index,
      frequency,
      color,
      converted: color
    })

    it('should create buckets for different hue families', () => {
      const colors: ColorFrequencyItem[] = [
        createColorItem(0, [255, 0, 0]), // Red (hue ~0)
        createColorItem(1, [0, 255, 0]), // Green (hue ~120)
        createColorItem(2, [0, 0, 255]) // Blue (hue ~240)
      ]

      const buckets = createHueBuckets(colors)

      // Should have 3 different buckets
      expect(buckets.size).toBe(3)
    })

    it('should put gray colors in gray bucket', () => {
      const colors: ColorFrequencyItem[] = [
        createColorItem(0, [128, 128, 128]), // Gray
        createColorItem(1, [64, 64, 64]), // Dark gray
        createColorItem(2, [192, 192, 192]) // Light gray
      ]

      const buckets = createHueBuckets(colors)

      // All should be in 'gray' bucket
      expect(buckets.size).toBe(1)
      expect(buckets.has('gray')).toBe(true)
      expect(buckets.get('gray')?.length).toBe(3)
    })

    it('should return empty map for empty input', () => {
      const buckets = createHueBuckets([])
      expect(buckets.size).toBe(0)
    })

    it('should handle mixed saturated and desaturated colors', () => {
      const colors: ColorFrequencyItem[] = [
        createColorItem(0, [255, 0, 0]), // Saturated red
        createColorItem(1, [128, 128, 128]), // Gray
        createColorItem(2, [0, 255, 0]) // Saturated green
      ]

      const buckets = createHueBuckets(colors)

      // Should have gray bucket and 2 hue buckets
      expect(buckets.has('gray')).toBe(true)
      expect(buckets.size).toBe(3)
    })
  })

  // ============================================================================
  // sortBucketsByFrequency
  // ============================================================================
  describe('sortBucketsByFrequency', () => {
    it('should sort buckets by total frequency descending', () => {
      const buckets = new Map<number | 'gray', ColorFrequencyItem[]>()
      buckets.set(0, [
        { index: 0, frequency: 0.1, color: [255, 0, 0], converted: [255, 0, 0] }
      ])
      buckets.set(1, [
        { index: 1, frequency: 0.5, color: [0, 255, 0], converted: [0, 255, 0] }
      ])
      buckets.set(2, [
        { index: 2, frequency: 0.3, color: [0, 0, 255], converted: [0, 0, 255] }
      ])

      const sorted = sortBucketsByFrequency(buckets)

      expect(sorted[0].bucket).toBe(1) // Highest frequency
      expect(sorted[1].bucket).toBe(2)
      expect(sorted[2].bucket).toBe(0) // Lowest frequency
    })

    it('should sort colors within each bucket by frequency', () => {
      const buckets = new Map<number | 'gray', ColorFrequencyItem[]>()
      buckets.set(0, [
        {
          index: 0,
          frequency: 0.1,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        {
          index: 1,
          frequency: 0.5,
          color: [200, 0, 0],
          converted: [200, 0, 0]
        },
        { index: 2, frequency: 0.3, color: [150, 0, 0], converted: [150, 0, 0] }
      ])

      const sorted = sortBucketsByFrequency(buckets)

      expect(sorted[0].colors[0].frequency).toBe(0.5)
      expect(sorted[0].colors[1].frequency).toBe(0.3)
      expect(sorted[0].colors[2].frequency).toBe(0.1)
    })

    it('should handle empty buckets map', () => {
      const buckets = new Map<number | 'gray', ColorFrequencyItem[]>()
      const sorted = sortBucketsByFrequency(buckets)
      expect(sorted).toEqual([])
    })
  })

  // ============================================================================
  // selectBucketRepresentatives
  // ============================================================================
  describe('selectBucketRepresentatives', () => {
    it('should select the most frequent color from each bucket', () => {
      const buckets: HueBucket[] = [
        {
          bucket: 0,
          colors: [
            {
              index: 0,
              frequency: 0.5,
              color: [255, 0, 0],
              converted: [255, 0, 0]
            },
            {
              index: 1,
              frequency: 0.3,
              color: [200, 0, 0],
              converted: [200, 0, 0]
            }
          ],
          totalFreq: 0.8
        },
        {
          bucket: 1,
          colors: [
            {
              index: 2,
              frequency: 0.2,
              color: [0, 255, 0],
              converted: [0, 255, 0]
            }
          ],
          totalFreq: 0.2
        }
      ]

      const reps = selectBucketRepresentatives(buckets, 10)

      expect(reps.length).toBe(2)
      expect(reps[0].index).toBe(0) // Most frequent from first bucket
      expect(reps[1].index).toBe(2) // Most frequent from second bucket
    })

    it('should respect maxRepresentatives limit', () => {
      const buckets: HueBucket[] = [
        {
          bucket: 0,
          colors: [
            {
              index: 0,
              frequency: 0.5,
              color: [255, 0, 0],
              converted: [255, 0, 0]
            }
          ],
          totalFreq: 0.5
        },
        {
          bucket: 1,
          colors: [
            {
              index: 1,
              frequency: 0.3,
              color: [0, 255, 0],
              converted: [0, 255, 0]
            }
          ],
          totalFreq: 0.3
        },
        {
          bucket: 2,
          colors: [
            {
              index: 2,
              frequency: 0.2,
              color: [0, 0, 255],
              converted: [0, 0, 255]
            }
          ],
          totalFreq: 0.2
        }
      ]

      const reps = selectBucketRepresentatives(buckets, 2)

      expect(reps.length).toBe(2)
    })

    it('should skip empty buckets', () => {
      const buckets: HueBucket[] = [
        {
          bucket: 0,
          colors: [],
          totalFreq: 0
        },
        {
          bucket: 1,
          colors: [
            {
              index: 1,
              frequency: 0.5,
              color: [0, 255, 0],
              converted: [0, 255, 0]
            }
          ],
          totalFreq: 0.5
        }
      ]

      const reps = selectBucketRepresentatives(buckets, 10)

      expect(reps.length).toBe(1)
      expect(reps[0].index).toBe(1)
    })
  })

  // ============================================================================
  // selectBucketRepresentativesWithLightness
  // ============================================================================
  describe('selectBucketRepresentativesWithLightness', () => {
    it('should limit representatives per mega-family', () => {
      // Buckets 0 and 1 are in mega-family 0
      const buckets: HueBucket[] = [
        {
          bucket: 0, // Mega-family 0
          colors: [
            {
              index: 0,
              frequency: 0.5,
              color: [255, 0, 0],
              converted: [255, 0, 0]
            }
          ],
          totalFreq: 0.5
        },
        {
          bucket: 1, // Mega-family 0 (same as bucket 0)
          colors: [
            {
              index: 1,
              frequency: 0.4,
              color: [255, 128, 0],
              converted: [255, 128, 0]
            }
          ],
          totalFreq: 0.4
        },
        {
          bucket: 2, // Mega-family 1
          colors: [
            {
              index: 2,
              frequency: 0.3,
              color: [0, 255, 0],
              converted: [0, 255, 0]
            }
          ],
          totalFreq: 0.3
        }
      ]

      const reps = selectBucketRepresentativesWithLightness(buckets, 10)

      // Should skip bucket 1 because mega-family 0 is already represented
      expect(reps.length).toBe(2)
      expect(reps.map((r) => r.index)).toContain(0)
      expect(reps.map((r) => r.index)).toContain(2)
      expect(reps.map((r) => r.index)).not.toContain(1)
    })

    it('should allow gray bucket to have representatives', () => {
      const buckets: HueBucket[] = [
        {
          bucket: 'gray',
          colors: [
            {
              index: 0,
              frequency: 0.5,
              color: [128, 128, 128],
              converted: [128, 128, 128]
            }
          ],
          totalFreq: 0.5
        },
        {
          bucket: 0,
          colors: [
            {
              index: 1,
              frequency: 0.4,
              color: [255, 0, 0],
              converted: [255, 0, 0]
            }
          ],
          totalFreq: 0.4
        }
      ]

      const reps = selectBucketRepresentativesWithLightness(buckets, 10)

      expect(reps.length).toBe(2)
    })
  })

  // ============================================================================
  // selectFrequentColorsWithDiversity
  // ============================================================================
  describe('selectFrequentColorsWithDiversity', () => {
    const simpleDistance = (a: Vector, b: Vector): number => {
      return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
    }

    it('should select diverse colors', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        {
          index: 1,
          frequency: 0.3,
          color: [0, 255, 0],
          converted: [0, 255, 0]
        },
        {
          index: 2,
          frequency: 0.2,
          color: [0, 0, 255],
          converted: [0, 0, 255]
        }
      ]

      const selectedConverted: Vector[] = []
      const result: number[] = []

      selectFrequentColorsWithDiversity(
        colorFrequency,
        selectedConverted,
        result,
        3,
        undefined,
        simpleDistance
      )

      // Should select colors that are far apart
      expect(result.length).toBeGreaterThan(0)
    })

    it('should reject colors that are too close in RGB space', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        },
        {
          index: 1,
          frequency: 0.3,
          color: [250, 0, 0],
          converted: [250, 0, 0]
        } // Very similar to index 0
      ]

      const selectedConverted: Vector[] = [[255, 0, 0]]
      const result: number[] = [0]

      selectFrequentColorsWithDiversity(
        colorFrequency,
        selectedConverted,
        result,
        2,
        4, // Mode 1-2 has higher min distance
        simpleDistance
      )

      // Should not add the similar color
      expect(result).not.toContain(1)
    })

    it('should handle empty input', () => {
      const selectedConverted: Vector[] = []
      const result: number[] = []

      selectFrequentColorsWithDiversity(
        [],
        selectedConverted,
        result,
        3,
        undefined,
        simpleDistance
      )

      expect(result.length).toBe(0)
    })
  })

  // ============================================================================
  // selectMaxMinDistanceColors
  // ============================================================================
  describe('selectMaxMinDistanceColors', () => {
    const simpleDistance = (a: Vector, b: Vector): number => {
      return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
    }

    it('should select colors that maximize minimum distance', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [0, 0, 0],
          converted: [0, 0, 0]
        },
        {
          index: 1,
          frequency: 0.3,
          color: [255, 255, 255],
          converted: [255, 255, 255]
        },
        {
          index: 2,
          frequency: 0.1,
          color: [128, 128, 128],
          converted: [128, 128, 128]
        },
        {
          index: 3,
          frequency: 0.1,
          color: [10, 10, 10],
          converted: [10, 10, 10]
        } // Close to black
      ]

      const selectedConverted: Vector[] = [[0, 0, 0]]
      const result: number[] = [0]

      selectMaxMinDistanceColors(
        colorFrequency,
        selectedConverted,
        result,
        2,
        simpleDistance
      )

      // Should select white (index 1) as it's furthest from black
      expect(result).toContain(1)
    })

    it('should not select already selected colors', () => {
      const colorFrequency: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [0, 0, 0],
          converted: [0, 0, 0]
        },
        {
          index: 1,
          frequency: 0.3,
          color: [255, 255, 255],
          converted: [255, 255, 255]
        }
      ]

      const selectedConverted: Vector[] = [
        [0, 0, 0],
        [255, 255, 255]
      ]
      const result: number[] = [0, 1]

      selectMaxMinDistanceColors(
        colorFrequency,
        selectedConverted,
        result,
        3,
        simpleDistance
      )

      // No duplicates
      expect(new Set(result).size).toBe(result.length)
    })
  })

  // ============================================================================
  // addBucketRepresentativesWithDistanceCheck
  // ============================================================================
  describe('addBucketRepresentativesWithDistanceCheck', () => {
    const simpleDistance = (a: Vector, b: Vector): number => {
      return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
    }

    it('should add representatives that are far enough from existing colors', () => {
      const representatives: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [255, 0, 0],
          converted: [255, 0, 0] // Red
        },
        {
          index: 1,
          frequency: 0.3,
          color: [0, 255, 0],
          converted: [0, 255, 0] // Green
        }
      ]

      const sortedBuckets: HueBucket[] = [
        { bucket: 0, colors: [representatives[0]], totalFreq: 0.5 },
        { bucket: 2, colors: [representatives[1]], totalFreq: 0.3 }
      ]

      const result: number[] = []
      const selectedConverted: Vector[] = []

      const stats = addBucketRepresentativesWithDistanceCheck(
        representatives,
        sortedBuckets,
        result,
        selectedConverted,
        simpleDistance
      )

      expect(stats.added).toBe(2)
      expect(stats.skipped).toBe(0)
      expect(result).toContain(0)
      expect(result).toContain(1)
    })

    it('should skip representatives that are too close in RGB', () => {
      const representatives: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [100, 100, 100],
          converted: [100, 100, 100]
        },
        {
          index: 1,
          frequency: 0.3,
          color: [105, 105, 105], // Very close to first
          converted: [105, 105, 105]
        }
      ]

      const sortedBuckets: HueBucket[] = [
        { bucket: 'gray', colors: representatives, totalFreq: 0.8 }
      ]

      const result: number[] = []
      const selectedConverted: Vector[] = []

      const stats = addBucketRepresentativesWithDistanceCheck(
        representatives,
        sortedBuckets,
        result,
        selectedConverted,
        simpleDistance
      )

      // First one added, second one skipped (too close)
      expect(stats.added).toBe(1)
      expect(stats.skipped).toBe(1)
      expect(result).toContain(0)
      expect(result).not.toContain(1)
    })

    it('should skip representatives that are too close in hue', () => {
      // Two saturated colors with similar hue
      const representatives: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [255, 0, 0],
          converted: [255, 0, 0] // Red, hue ~ 0°
        },
        {
          index: 1,
          frequency: 0.3,
          color: [255, 50, 0],
          converted: [255, 50, 0] // Orange-red, hue ~ 12°
        }
      ]

      const sortedBuckets: HueBucket[] = [
        { bucket: 0, colors: representatives, totalFreq: 0.8 }
      ]

      const result: number[] = []
      const selectedConverted: Vector[] = []

      const stats = addBucketRepresentativesWithDistanceCheck(
        representatives,
        sortedBuckets,
        result,
        selectedConverted,
        simpleDistance
      )

      // First one added, second skipped due to close hue
      expect(stats.added).toBe(1)
      expect(stats.skipped).toBe(1)
    })

    it('should not add already selected indices', () => {
      const representatives: ColorFrequencyItem[] = [
        {
          index: 0,
          frequency: 0.5,
          color: [255, 0, 0],
          converted: [255, 0, 0]
        }
      ]

      const sortedBuckets: HueBucket[] = [
        { bucket: 0, colors: representatives, totalFreq: 0.5 }
      ]

      const result: number[] = [0] // Already selected
      const selectedConverted: Vector[] = [[255, 0, 0]]

      const stats = addBucketRepresentativesWithDistanceCheck(
        representatives,
        sortedBuckets,
        result,
        selectedConverted,
        simpleDistance
      )

      expect(stats.added).toBe(0)
      expect(stats.skipped).toBe(0) // Not counted as skipped, just ignored
    })

    it('should handle empty representatives list', () => {
      const result: number[] = []
      const selectedConverted: Vector[] = []

      const stats = addBucketRepresentativesWithDistanceCheck(
        [],
        [],
        result,
        selectedConverted,
        simpleDistance
      )

      expect(stats.added).toBe(0)
      expect(stats.skipped).toBe(0)
      expect(result).toHaveLength(0)
    })
  })
})
