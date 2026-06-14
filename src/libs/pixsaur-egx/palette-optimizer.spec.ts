import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { getHardwarePalette, optimizeEGXPalette } from './palette-optimizer'
import type { EGXConfig } from './types'

const baseConfig: EGXConfig = {
  type: 'egx1',
  firstLineMode: 'low',
  targetHardware: 'classic',
  ditheringMode: 'none',
  ditheringIntensity: 0
}

/**
 * Build an RGBA buffer (Uint8ClampedArray) of size width*height filled
 * with a deterministic pattern: a handful of distinct, well-separated
 * colors cycled across pixels so the histogram has clear winners.
 */
function buildImage(
  width: number,
  height: number,
  colors: Vector<'RGB'>[]
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const c = colors[(y * width + x) % colors.length]
      data[idx] = c[0]
      data[idx + 1] = c[1]
      data[idx + 2] = c[2]
      data[idx + 3] = 255
    }
  }
  return data
}

function paletteContains(
  palette: Vector<'RGB'>[],
  color: Vector<'RGB'>
): boolean {
  return palette.some(
    (p) => p[0] === color[0] && p[1] === color[1] && p[2] === color[2]
  )
}

describe('getHardwarePalette', () => {
  it('returns the 27-color CPC Classic palette', () => {
    const palette = getHardwarePalette('classic')
    expect(palette).toHaveLength(27)
  })

  it('builds the Classic palette from the 0/128/255 level cube', () => {
    const palette = getHardwarePalette('classic')
    const levels = new Set<number>()
    for (const [r, g, b] of palette) {
      levels.add(r)
      levels.add(g)
      levels.add(b)
    }
    expect([...levels].sort((a, b) => a - b)).toEqual([0, 128, 255])
  })

  it('orders Classic entries with black first and white last', () => {
    const palette = getHardwarePalette('classic')
    expect(palette[0]).toEqual([0, 0, 0])
    expect(palette[palette.length - 1]).toEqual([255, 255, 255])
  })

  it('returns the 4096-color CPC Plus palette', () => {
    const palette = getHardwarePalette('plus')
    expect(palette).toHaveLength(4096)
  })

  it('builds Plus entries as multiples of 17 in 0..255', () => {
    const palette = getHardwarePalette('plus')
    expect(palette[0]).toEqual([0, 0, 0])
    expect(palette[palette.length - 1]).toEqual([255, 255, 255])
    for (const [r, g, b] of palette) {
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
        expect(channel % 17).toBe(0)
      }
    }
  })

  it('keeps every channel within the 0..255 RGB range', () => {
    for (const target of ['classic', 'plus'] as const) {
      for (const [r, g, b] of getHardwarePalette(target)) {
        for (const channel of [r, g, b]) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(255)
        }
      }
    }
  })

  it('produces unique colors', () => {
    for (const target of ['classic', 'plus'] as const) {
      const palette = getHardwarePalette(target)
      const keys = new Set(palette.map((c) => c.join(',')))
      expect(keys.size).toBe(palette.length)
    }
  })
})

describe('optimizeEGXPalette', () => {
  const width = 8
  const height = 8
  // Pure primaries/black/white drawn from the Classic hardware set.
  const sampleColors: Vector<'RGB'>[] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 0, 0],
    [255, 255, 255]
  ]
  // The full 27-color Classic set — guarantees enough distinct colors to
  // fill all 16 EGX1 slots.
  const richColors = getHardwarePalette('classic')

  it('selects up to 16 colors with 4 shared colors for EGX1', () => {
    const image = buildImage(width, height, richColors)
    const result = optimizeEGXPalette(image, width, height, baseConfig)
    expect(result.colors).toHaveLength(16)
    expect(result.sharedColorCount).toBe(4)
  })

  it('never exceeds the EGX1 palette budget even with few colors', () => {
    const image = buildImage(width, height, sampleColors)
    const result = optimizeEGXPalette(image, width, height, baseConfig)
    expect(result.colors.length).toBeLessThanOrEqual(16)
    expect(result.colors.length).toBeGreaterThan(0)
    expect(result.sharedColorCount).toBe(4)
  })

  it('returns a 4-color palette with 2 shared colors for EGX2', () => {
    const image = buildImage(width, height, sampleColors)
    const result = optimizeEGXPalette(image, width, height, {
      ...baseConfig,
      type: 'egx2'
    })
    expect(result.colors).toHaveLength(4)
    expect(result.sharedColorCount).toBe(2)
  })

  it('only emits colors that belong to the hardware palette', () => {
    const image = buildImage(width, height, sampleColors)
    const hardware = getHardwarePalette('classic')
    const result = optimizeEGXPalette(image, width, height, baseConfig)
    for (const color of result.colors) {
      expect(paletteContains(hardware, color)).toBe(true)
    }
  })

  it('respects the Plus hardware target', () => {
    const image = buildImage(width, height, richColors)
    const hardware = getHardwarePalette('plus')
    const result = optimizeEGXPalette(image, width, height, {
      ...baseConfig,
      targetHardware: 'plus'
    })
    expect(result.colors).toHaveLength(16)
    for (const color of result.colors) {
      expect(paletteContains(hardware, color)).toBe(true)
    }
  })

  it('is deterministic for identical inputs', () => {
    const imageA = buildImage(width, height, sampleColors)
    const imageB = buildImage(width, height, sampleColors)
    const a = optimizeEGXPalette(imageA, width, height, baseConfig)
    const b = optimizeEGXPalette(imageB, width, height, baseConfig)
    expect(b.colors).toEqual(a.colors)
    expect(b.sharedColorCount).toBe(a.sharedColorCount)
    expect(b.stats).toEqual(a.stats)
  })

  it('produces palette entries with valid RGB channels', () => {
    const image = buildImage(width, height, sampleColors)
    const result = optimizeEGXPalette(image, width, height, baseConfig)
    for (const [r, g, b] of result.colors) {
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
      }
    }
  })

  it('reports non-negative stats consistent with the palette', () => {
    const image = buildImage(width, height, sampleColors)
    const result = optimizeEGXPalette(image, width, height, baseConfig)
    const { stats } = result
    expect(stats.colorsUsedLowMode).toBeGreaterThanOrEqual(0)
    expect(stats.colorsUsedHighMode).toBeGreaterThanOrEqual(0)
    expect(stats.avgErrorLowMode).toBeGreaterThanOrEqual(0)
    expect(stats.avgErrorHighMode).toBeGreaterThanOrEqual(0)
    // High-res lines are constrained to the shared slots, so they can never
    // use more distinct colors than sharedColorCount.
    expect(stats.colorsUsedHighMode).toBeLessThanOrEqual(
      result.sharedColorCount
    )
    expect(stats.colorsUsedLowMode).toBeLessThanOrEqual(result.colors.length)
    expect(stats.totalError).toBeGreaterThanOrEqual(0)
    // totalError is the sum of the two per-mode error accumulators.
    expect(stats.totalError).toBeCloseTo(
      stats.avgErrorLowMode * (width * (height / 2)) +
        stats.avgErrorHighMode * (width * (height / 2)),
      4
    )
  })

  it('yields zero average error when every source color is on the hardware set', () => {
    // A single Classic color used everywhere must be representable exactly.
    const image = buildImage(width, height, [[128, 0, 255]])
    const result = optimizeEGXPalette(image, width, height, baseConfig)
    expect(result.stats.avgErrorLowMode).toBeCloseTo(0, 5)
    expect(result.stats.avgErrorHighMode).toBeCloseTo(0, 5)
    expect(result.stats.totalError).toBeCloseTo(0, 5)
  })

  it('handles firstLineMode high without changing palette size', () => {
    const image = buildImage(width, height, richColors)
    const result = optimizeEGXPalette(image, width, height, {
      ...baseConfig,
      firstLineMode: 'high'
    })
    expect(result.colors).toHaveLength(16)
    expect(result.sharedColorCount).toBe(4)
  })
})
