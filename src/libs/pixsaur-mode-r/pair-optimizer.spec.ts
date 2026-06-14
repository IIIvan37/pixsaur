import { describe, expect, it } from 'vitest'
import type { Vector } from '../pixsaur-color/src/type'
import { blendColors, calculateFlickerScore } from './blend'
import {
  findNearestColor,
  generateCPCClassicPalette,
  generateCPCPlusPalette,
  optimizeModeRPalettes
} from './pair-optimizer'
import type { ModeRConfig } from './types'
import { DEFAULT_MODE_R_CONFIG } from './types'

const key = (c: Vector<'RGB'>): string => `${c[0]},${c[1]},${c[2]}`

describe('generateCPCClassicPalette', () => {
  it('produces exactly 27 colors (3 levels per channel)', () => {
    expect(generateCPCClassicPalette()).toHaveLength(27)
  })

  it('only uses the levels 0, 128 and 255 on every channel', () => {
    const levels = new Set([0, 128, 255])
    for (const color of generateCPCClassicPalette()) {
      expect(levels.has(color[0])).toBe(true)
      expect(levels.has(color[1])).toBe(true)
      expect(levels.has(color[2])).toBe(true)
    }
  })

  it('contains pure black and pure white', () => {
    const keys = new Set(generateCPCClassicPalette().map(key))
    expect(keys.has('0,0,0')).toBe(true)
    expect(keys.has('255,255,255')).toBe(true)
  })

  it('has no duplicate colors', () => {
    const palette = generateCPCClassicPalette()
    expect(new Set(palette.map(key)).size).toBe(palette.length)
  })
})

describe('generateCPCPlusPalette', () => {
  it('produces exactly 4096 colors (16 levels per channel)', () => {
    expect(generateCPCPlusPalette()).toHaveLength(4096)
  })

  it('quantizes every channel to a multiple of 17 within 0-255', () => {
    for (const color of generateCPCPlusPalette()) {
      for (const channel of color) {
        expect(channel % 17).toBe(0)
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
      }
    }
  })

  it('contains pure black and pure white', () => {
    const keys = new Set(generateCPCPlusPalette().map(key))
    expect(keys.has('0,0,0')).toBe(true)
    expect(keys.has('255,255,255')).toBe(true)
  })

  it('has no duplicate colors', () => {
    const palette = generateCPCPlusPalette()
    expect(new Set(palette.map(key)).size).toBe(palette.length)
  })
})

describe('findNearestColor', () => {
  it('returns an exact match when the target exists in the set', () => {
    const available: Vector<'RGB'>[] = [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0]
    ]
    expect(findNearestColor([0, 255, 0], available)).toEqual([0, 255, 0])
  })

  it('returns the only available color for a singleton set', () => {
    const available: Vector<'RGB'>[] = [[10, 20, 30]]
    expect(findNearestColor([200, 200, 200], available)).toEqual([10, 20, 30])
  })

  it('picks the perceptually closest color (green weighted higher)', () => {
    // Target is a mid green. The weighted distance metric (BT.601) weights
    // green at 0.587, so the green-leaning candidate wins clearly.
    const available: Vector<'RGB'>[] = [
      [255, 0, 0],
      [0, 130, 0],
      [0, 0, 255]
    ]
    expect(findNearestColor([0, 128, 0], available)).toEqual([0, 130, 0])
  })

  it('keeps the first candidate on a tie (no later replacement)', () => {
    // Two candidates equidistant from the target: the earlier one is kept
    // because the loop only replaces on strictly smaller distance.
    const available: Vector<'RGB'>[] = [
      [100, 100, 100],
      [110, 110, 110]
    ]
    expect(findNearestColor([105, 105, 105], available)).toEqual([
      100, 100, 100
    ])
  })
})

const baseConfig = (overrides: Partial<ModeRConfig> = {}): ModeRConfig => ({
  ...DEFAULT_MODE_R_CONFIG,
  ...overrides
})

describe('optimizeModeRPalettes', () => {
  const targets: Vector<'RGB'>[] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 255, 255],
    [0, 0, 0]
  ]

  it('always returns two palettes of exactly 16 colors each', () => {
    const { paletteA, paletteB } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ targetHardware: 'plus', useDualPalette: true })
    )
    expect(paletteA).toHaveLength(16)
    expect(paletteB).toHaveLength(16)
  })

  it('returns exactly 16 pairs with consistent indices', () => {
    const { pairs } = optimizeModeRPalettes(targets, undefined, baseConfig())
    expect(pairs).toHaveLength(16)
    pairs.forEach((pair, i) => {
      expect(pair.index).toBe(i)
    })
  })

  it('derives each pair blend and flicker from its A/B colors', () => {
    const { paletteA, paletteB, pairs } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ useDualPalette: true })
    )
    pairs.forEach((pair, i) => {
      expect(pair.colorA).toEqual(paletteA[i])
      expect(pair.colorB).toEqual(paletteB[i])
      expect(pair.blendedColor).toEqual(blendColors(paletteA[i], paletteB[i]))
      expect(pair.flickerScore).toBe(
        calculateFlickerScore(paletteA[i], paletteB[i])
      )
    })
  })

  it('uses the same palette for both frames in single-palette mode', () => {
    const { paletteA, paletteB } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ useDualPalette: false })
    )
    expect(paletteB).toEqual(paletteA)
  })

  it('every diagonal pair has zero flicker in single-palette mode', () => {
    // pairs[i] is (A[i], B[i]) and B === A, so the diagonal never flickers.
    // (stats.maxFlicker covers the full 16x16 matrix, including off-diagonal
    // A[i]/A[j] pairs which CAN flicker, so it is not asserted here.)
    const { pairs } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ useDualPalette: false })
    )
    for (const pair of pairs) {
      expect(pair.flickerScore).toBe(0)
    }
  })

  it('emits only hardware-valid colors for CPC Classic (levels 0/128/255)', () => {
    const { paletteA, paletteB } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ targetHardware: 'classic', useDualPalette: true })
    )
    const levels = new Set([0, 128, 255])
    for (const color of [...paletteA, ...paletteB]) {
      // Padding black [0,0,0] is also valid here.
      expect(levels.has(color[0])).toBe(true)
      expect(levels.has(color[1])).toBe(true)
      expect(levels.has(color[2])).toBe(true)
    }
  })

  it('emits only multiples of 17 for CPC Plus', () => {
    const { paletteA, paletteB } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ targetHardware: 'plus', useDualPalette: true })
    )
    for (const color of [...paletteA, ...paletteB]) {
      for (const channel of color) {
        expect(channel % 17).toBe(0)
      }
    }
  })

  it('guarantees black is present in both palettes for margin handling', () => {
    const hasBlack = (palette: Vector<'RGB'>[]): boolean =>
      palette.some((c) => c[0] <= 17 && c[1] <= 17 && c[2] <= 17)
    const { paletteA, paletteB } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ targetHardware: 'plus', useDualPalette: true })
    )
    expect(hasBlack(paletteA)).toBe(true)
    expect(hasBlack(paletteB)).toBe(true)
  })

  it('handles an empty target list without throwing and still pads to 16', () => {
    const { paletteA, paletteB, pairs } = optimizeModeRPalettes(
      [],
      undefined,
      baseConfig({ useDualPalette: true })
    )
    expect(paletteA).toHaveLength(16)
    expect(paletteB).toHaveLength(16)
    expect(pairs).toHaveLength(16)
  })

  it('falls back to uniform weights when weights mismatch target length', () => {
    // A wrong-length weights array must not throw; uniform weights kick in.
    const wrongWeights = [1, 2]
    const result = optimizeModeRPalettes(
      targets,
      wrongWeights,
      baseConfig({ useDualPalette: true })
    )
    expect(result.paletteA).toHaveLength(16)
    expect(result.paletteB).toHaveLength(16)
  })

  it('produces stats consistent with the full 16x16 blend matrix', () => {
    const { paletteA, paletteB, stats } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ useDualPalette: true })
    )

    const uniqueBlends = new Set<string>()
    let maxFlicker = 0
    let noFlicker = 0
    for (const a of paletteA) {
      for (const b of paletteB) {
        const blended = blendColors(a, b)
        uniqueBlends.add(key(blended))
        const flicker = calculateFlickerScore(a, b)
        if (flicker > maxFlicker) maxFlicker = flicker
        if (
          flicker <= DEFAULT_MODE_R_CONFIG.maxLuminanceDelta &&
          flicker === 0
        ) {
          noFlicker++
        }
      }
    }

    expect(stats.uniquePerceivedColors).toBe(uniqueBlends.size)
    expect(stats.maxFlicker).toBe(maxFlicker)
    expect(stats.noFlickerPairs).toBe(noFlicker)
    expect(stats.uniquePerceivedColors).toBeGreaterThan(0)
    expect(stats.uniquePerceivedColors).toBeLessThanOrEqual(256)
  })

  it('reports non-negative averageFlicker within maxFlicker bound', () => {
    const { stats } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ useDualPalette: true })
    )
    expect(stats.averageFlicker).toBeGreaterThanOrEqual(0)
    expect(stats.averageFlicker).toBeLessThanOrEqual(stats.maxFlicker)
  })

  it('single-palette mode still averages over within-tolerance pairs (incl. off-diagonal)', () => {
    // averageFlicker is computed over ALL pairs within maxLuminanceDelta, which
    // includes off-diagonal A[i]/A[j] pairs, so it is non-negative and bounded
    // by maxFlicker rather than necessarily zero.
    const { stats } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ useDualPalette: false })
    )
    expect(stats.averageFlicker).toBeGreaterThanOrEqual(0)
    expect(stats.averageFlicker).toBeLessThanOrEqual(stats.maxFlicker)
  })

  it('single-palette mode counts at least 16 no-flicker pairs (the diagonal)', () => {
    const { stats } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ useDualPalette: false })
    )
    expect(stats.noFlickerPairs).toBeGreaterThanOrEqual(16)
  })

  it('covers requested target colors among the achievable blends', () => {
    // With saturated primaries as targets, the optimizer should be able to
    // reproduce at least some of them exactly through a blend.
    const { paletteA, paletteB } = optimizeModeRPalettes(
      targets,
      undefined,
      baseConfig({ targetHardware: 'plus', useDualPalette: true })
    )
    const blends = new Set<string>()
    for (const a of paletteA) {
      for (const b of paletteB) {
        blends.add(key(blendColors(a, b)))
      }
    }
    // Black target [0,0,0] is always reproducible since black is forced in.
    expect(blends.has('0,0,0')).toBe(true)
  })

  it('exercises the CPC Plus palette-B voting path with many varied targets', () => {
    // A larger, varied set of explicit weights drives the candidate scoring,
    // diversity and relaxation phases of palette B for CPC Plus.
    const manyTargets: Vector<'RGB'>[] = []
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 85) {
        manyTargets.push([r, g, 255 - r])
      }
    }
    const weights = manyTargets.map((_, i) => i + 1)
    const { paletteA, paletteB, stats } = optimizeModeRPalettes(
      manyTargets,
      weights,
      baseConfig({ targetHardware: 'plus', useDualPalette: true })
    )
    expect(paletteA).toHaveLength(16)
    expect(paletteB).toHaveLength(16)
    expect(stats.uniquePerceivedColors).toBeGreaterThan(1)
  })

  it('exercises the CPC Classic palette-B voting path with varied targets', () => {
    const manyTargets: Vector<'RGB'>[] = []
    for (let r = 0; r <= 255; r += 85) {
      for (let g = 0; g <= 255; g += 85) {
        manyTargets.push([r, g, 128])
      }
    }
    const weights = manyTargets.map((_, i) => i + 1)
    const { paletteA, paletteB } = optimizeModeRPalettes(
      manyTargets,
      weights,
      baseConfig({ targetHardware: 'classic', useDualPalette: true })
    )
    expect(paletteA).toHaveLength(16)
    expect(paletteB).toHaveLength(16)
  })

  it('forces black into palettes that contain only bright colors', () => {
    // Bright-only targets keep black out of the selection, exercising the
    // "Added black for margin handling" replacement branch.
    const brightTargets: Vector<'RGB'>[] = [
      [255, 255, 255],
      [255, 238, 255],
      [238, 255, 255],
      [255, 255, 238]
    ]
    const hasBlack = (palette: Vector<'RGB'>[]): boolean =>
      palette.some((c) => c[0] <= 17 && c[1] <= 17 && c[2] <= 17)
    const { paletteA, paletteB } = optimizeModeRPalettes(
      brightTargets,
      undefined,
      baseConfig({ targetHardware: 'plus', useDualPalette: true })
    )
    // Black is guaranteed present afterward even though no target was dark.
    expect(hasBlack(paletteA)).toBe(true)
    expect(hasBlack(paletteB)).toBe(true)
  })

  it('default config (used as the literal default arg) yields valid palettes', () => {
    const { paletteA, paletteB, pairs, stats } = optimizeModeRPalettes(
      targets,
      undefined
    )
    expect(paletteA).toHaveLength(16)
    expect(paletteB).toHaveLength(16)
    expect(pairs).toHaveLength(16)
    expect(stats.uniquePerceivedColors).toBeGreaterThan(0)
  })
})
