import { describe, expect, it } from 'vitest'
import type { Vector } from '../pixsaur-color/src/type'
import {
  analyzeHighResLineColors,
  combinations,
  optimizePaletteForEGX
} from './palette-reorder'
import type { EGXConfig } from './types'

// Helper: materialise a generator into a plain array of arrays
function toArray(gen: Generator<number[]>): number[][] {
  return [...gen]
}

// Minimal valid EGX config with overridable fields
function makeConfig(over: Partial<EGXConfig> = {}): EGXConfig {
  return {
    type: 'egx1',
    firstLineMode: 'low',
    targetHardware: 'classic',
    ditheringMode: 'none',
    ditheringIntensity: 0,
    ...over
  }
}

// Build an ImageData where every row is filled with one solid RGB color.
// rowColors[y] is the [r,g,b] used for the whole of row y.
function imageFromRowColors(
  width: number,
  rowColors: Vector<'RGB'>[]
): ImageData {
  const height = rowColors.length
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const [r, g, b] = rowColors[y] as [number, number, number]
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }
  return new ImageData(data, width, height)
}

describe('combinations', () => {
  it('yields all 2-combinations of [0,1,2] in lexicographic order', () => {
    expect(toArray(combinations([0, 1, 2], 2))).toEqual([
      [0, 1],
      [0, 2],
      [1, 2]
    ])
  })

  it('yields all 2-combinations of [0,1,2,3]', () => {
    expect(toArray(combinations([0, 1, 2, 3], 2))).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3]
    ])
  })

  it('yields the element values, not indices, when arr is not 0..n', () => {
    expect(toArray(combinations([10, 20, 30], 2))).toEqual([
      [10, 20],
      [10, 30],
      [20, 30]
    ])
  })

  it('produces C(n,k) combinations for several n,k', () => {
    const cnk = (n: number, k: number): number => {
      let num = 1
      let den = 1
      for (let i = 0; i < k; i++) {
        num *= n - i
        den *= i + 1
      }
      return num / den
    }
    for (const [n, k] of [
      [5, 1],
      [5, 2],
      [5, 3],
      [6, 3],
      [7, 4]
    ] as const) {
      const arr = Array.from({ length: n }, (_, i) => i)
      expect(toArray(combinations(arr, k))).toHaveLength(cnk(n, k))
    }
  })

  it('yields a single empty combination when k = 0', () => {
    expect(toArray(combinations([0, 1, 2], 0))).toEqual([[]])
  })

  it('yields nothing when k > n', () => {
    expect(toArray(combinations([0, 1], 5))).toEqual([])
  })

  it('yields one full combination when k === n', () => {
    expect(toArray(combinations([0, 1, 2], 3))).toEqual([[0, 1, 2]])
  })

  it('yields nothing for k > n even with an empty array', () => {
    expect(toArray(combinations([], 1))).toEqual([])
  })

  it('yields a single empty combination for empty array with k = 0', () => {
    expect(toArray(combinations([], 0))).toEqual([[]])
  })
})

describe('analyzeHighResLineColors', () => {
  const palette: Vector<'RGB'>[] = [
    [0, 0, 0], // index 0: black
    [255, 0, 0], // index 1: red
    [0, 255, 0], // index 2: green
    [0, 0, 255] // index 3: blue
  ]

  it('initialises a usage count for every palette index', () => {
    const image = imageFromRowColors(4, [[0, 0, 0]])
    const usage = analyzeHighResLineColors(image, palette, makeConfig())
    expect(usage.size).toBe(palette.length)
    for (let i = 0; i < palette.length; i++) {
      expect(usage.has(i)).toBe(true)
    }
  })

  it('counts odd rows as high-res when firstLineMode is "low"', () => {
    // 4 wide, rows: 0=black,1=red,2=green,3=blue
    // firstLineMode 'low' -> high-res lines are odd rows (1 and 3)
    const image = imageFromRowColors(4, [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ])
    const usage = analyzeHighResLineColors(
      image,
      palette,
      makeConfig({ firstLineMode: 'low' })
    )
    // Only rows 1 (red) and 3 (blue) counted, 4 px each
    expect(usage.get(0)).toBe(0)
    expect(usage.get(1)).toBe(4)
    expect(usage.get(2)).toBe(0)
    expect(usage.get(3)).toBe(4)
  })

  it('counts even rows as high-res when firstLineMode is "high"', () => {
    const image = imageFromRowColors(4, [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ])
    const usage = analyzeHighResLineColors(
      image,
      palette,
      makeConfig({ firstLineMode: 'high' })
    )
    // Only rows 0 (black) and 2 (green) counted, 4 px each
    expect(usage.get(0)).toBe(4)
    expect(usage.get(1)).toBe(0)
    expect(usage.get(2)).toBe(4)
    expect(usage.get(3)).toBe(0)
  })

  it('maps each pixel to its nearest palette color', () => {
    // A near-red pixel snaps to the red index, not exact match required
    const image = imageFromRowColors(2, [
      [0, 0, 0],
      [250, 5, 5] // close to pure red index 1
    ])
    const usage = analyzeHighResLineColors(
      image,
      palette,
      makeConfig({ firstLineMode: 'low' })
    )
    // Row 1 is high-res, 2 px both nearest to red
    expect(usage.get(1)).toBe(2)
    expect(usage.get(0)).toBe(0)
  })

  it('returns all-zero counts when there are no high-res lines', () => {
    // Single even row, firstLineMode 'low' -> row 0 is low-res, skipped
    const image = imageFromRowColors(4, [[255, 0, 0]])
    const usage = analyzeHighResLineColors(
      image,
      palette,
      makeConfig({ firstLineMode: 'low' })
    )
    for (let i = 0; i < palette.length; i++) {
      expect(usage.get(i)).toBe(0)
    }
  })

  it('total counted pixels equals (high-res line count) * width', () => {
    const image = imageFromRowColors(3, [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [0, 0, 0]
    ])
    const usage = analyzeHighResLineColors(
      image,
      palette,
      makeConfig({ firstLineMode: 'low' })
    )
    // high-res rows are odd: rows 1 and 3 => 2 lines * width 3 = 6
    let total = 0
    for (const v of usage.values()) total += v
    expect(total).toBe(6)
  })
})

describe('optimizePaletteForEGX', () => {
  const palette: Vector<'RGB'>[] = [
    [0, 0, 0], // 0
    [255, 0, 0], // 1
    [0, 255, 0], // 2
    [0, 0, 255], // 3
    [255, 255, 0] // 4
  ]

  it('returns a palette of the same length as the input', () => {
    const usage = new Map<number, number>([
      [0, 10],
      [1, 5],
      [2, 3],
      [3, 1],
      [4, 0]
    ])
    const result = optimizePaletteForEGX(palette, usage, 2, false)
    expect(result).toHaveLength(palette.length)
  })

  it('every output color comes from the input palette (classic)', () => {
    const usage = new Map<number, number>([
      [0, 10],
      [1, 5],
      [2, 3],
      [3, 1],
      [4, 0]
    ])
    const result = optimizePaletteForEGX(palette, usage, 2, false)
    const inputSet = new Set(palette.map((c) => (c as number[]).join(',')))
    for (const c of result) {
      expect(inputSet.has((c as number[]).join(','))).toBe(true)
    }
  })

  it('selects the shared slots by maximising 0.7*coverage + 0.3*contrast (classic)', () => {
    // Classic (isPlus=false) has no distance constraint, so the best combo is
    // the one with the maximum score over all C(n,sharedCount) pairs. We
    // compute that winner independently here from the same formula the source
    // uses, then assert the optimizer's shared slots match it exactly.
    const usage = new Map<number, number>([
      [0, 1],
      [1, 100],
      [2, 90],
      [3, 2],
      [4, 1]
    ])
    const sharedCount = 2

    const distSq = (a: Vector<'RGB'>, b: Vector<'RGB'>): number => {
      const av = a as number[]
      const bv = b as number[]
      const dr = av[0] - bv[0]
      const dg = av[1] - bv[1]
      const db = av[2] - bv[2]
      return dr * dr + dg * dg + db * db
    }

    // top indices = max(8, sharedCount) most used => all 5 here (sorted desc)
    const sortedIndices = [...usage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([idx]) => idx)
    const topIndices = sortedIndices.slice(0, Math.max(8, sharedCount))

    let bestScore = -Infinity
    let expectedCombo: number[] = []
    for (const combo of combinations(topIndices, sharedCount)) {
      let coverage = 0
      for (const idx of combo) coverage += usage.get(idx) ?? 0
      let contrast = 0
      let pairs = 0
      for (let i = 0; i < combo.length; i++) {
        for (let j = i + 1; j < combo.length; j++) {
          contrast += distSq(palette[combo[i]], palette[combo[j]])
          pairs++
        }
      }
      contrast = pairs > 0 ? contrast / pairs : 0
      const score = 0.7 * coverage + 0.3 * contrast
      if (score > bestScore) {
        bestScore = score
        expectedCombo = combo
      }
    }

    const result = optimizePaletteForEGX(palette, usage, sharedCount, false)
    const shared = result
      .slice(0, sharedCount)
      .map((c) => (c as number[]).join(','))
    const expectedShared = expectedCombo.map((idx) => palette[idx].join(','))
    expect(shared).toEqual(expectedShared)
  })

  it('is deterministic across repeated calls with identical input', () => {
    const usage = new Map<number, number>([
      [0, 7],
      [1, 6],
      [2, 5],
      [3, 4],
      [4, 3]
    ])
    const a = optimizePaletteForEGX(palette, usage, 2, false)
    const b = optimizePaletteForEGX(palette, usage, 2, false)
    expect(a).toEqual(b)
  })

  it('pads with black when sharedCount cannot be satisfied from usage', () => {
    // Usage only references index 0; topIndices has a single entry so the
    // shared slot selection cannot fill sharedCount=2, and the tail is
    // padded with black to reach palette length.
    const smallPalette: Vector<'RGB'>[] = [
      [12, 34, 56],
      [78, 90, 11]
    ]
    const usage = new Map<number, number>([[0, 5]])
    const result = optimizePaletteForEGX(smallPalette, usage, 2, false)
    expect(result).toHaveLength(smallPalette.length)
    // Last slot is padded black since only one index was known
    expect(result[result.length - 1]).toEqual([0, 0, 0])
  })

  it('keeps all distinct input colors present when usage covers them all', () => {
    const usage = new Map<number, number>([
      [0, 5],
      [1, 4],
      [2, 3],
      [3, 2],
      [4, 1]
    ])
    const result = optimizePaletteForEGX(palette, usage, 2, false)
    const resultSet = new Set(result.map((c) => (c as number[]).join(',')))
    for (const c of palette) {
      expect(resultSet.has((c as number[]).join(','))).toBe(true)
    }
  })

  it('rejects perceptually too-close colors from shared slots on Plus', () => {
    // On Plus (isPlus=true) shared colors must be >= 100 RGB units apart.
    // Index 0 and 1 are near-identical greys; index 0 is most used, so the
    // optimizer must skip 1 for the second shared slot and pick a distant one.
    const plusPalette: Vector<'RGB'>[] = [
      [10, 10, 10], // 0: very dark grey (most used)
      [20, 20, 20], // 1: near-identical dark grey
      [255, 255, 255], // 2: white, far from the greys
      [255, 0, 0] // 3: red, also far
    ]
    const usage = new Map<number, number>([
      [0, 100],
      [1, 90],
      [2, 5],
      [3, 4]
    ])
    const result = optimizePaletteForEGX(plusPalette, usage, 2, true)
    const shared = result.slice(0, 2).map((c) => (c as number[]).join(','))
    // Slot 0 keeps the most-used dark grey, but slot 1 cannot be the
    // near-identical grey (too close on Plus).
    expect(shared).toContain(plusPalette[0].join(','))
    expect(shared).not.toContain(plusPalette[1].join(','))
  })

  it('falls back to most-used colors when no valid Plus combination exists', () => {
    // Every color is within the Plus minimum distance of every other, so no
    // combination of 2 is valid; selectFallbackColors then fills the shared
    // slots with the most-used colors regardless of the distance constraint.
    const clusteredPalette: Vector<'RGB'>[] = [
      [10, 10, 10],
      [15, 15, 15],
      [20, 20, 20],
      [25, 25, 25]
    ]
    const usage = new Map<number, number>([
      [0, 40],
      [1, 30],
      [2, 20],
      [3, 10]
    ])
    const result = optimizePaletteForEGX(clusteredPalette, usage, 2, true)
    expect(result).toHaveLength(clusteredPalette.length)
    // Fallback keeps the two most-used colors and every input color survives
    const resultSet = new Set(result.map((c) => (c as number[]).join(',')))
    for (const c of clusteredPalette) {
      expect(resultSet.has((c as number[]).join(','))).toBe(true)
    }
  })

  it('defaults isPlus to false when omitted', () => {
    const usage = new Map<number, number>([
      [0, 5],
      [1, 4],
      [2, 3],
      [3, 2],
      [4, 1]
    ])
    const withDefault = optimizePaletteForEGX(palette, usage, 2)
    const explicit = optimizePaletteForEGX(palette, usage, 2, false)
    expect(withDefault).toEqual(explicit)
  })
})
