import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  applyEGXDitheringByMode,
  colorDistanceSquared,
  findClosestInSubset
} from './dithering'
import type { EGXConfig } from './types'
import { getMaxColorIndex, getModeForLine } from './types'

type RGBA = [number, number, number, number]

/** Build an ImageData of `width`×`height`, each pixel from `fill(x, y)`. */
function makeImage(
  width: number,
  height: number,
  fill: (x: number, y: number) => RGBA
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y)
      const idx = (y * width + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }
  return new ImageData(data, width, height)
}

const uniform =
  (r: number, g: number, b: number, a = 255) =>
  (): RGBA => [r, g, b, a]

/**
 * 16-colour EGX1 palette. The first 4 entries (INK 0-3) are the colours that
 * Mode 1 (high-res) lines may use; the full 16 are available on Mode 0 lines.
 * Kept simple and well separated so nearest-colour matches are unambiguous.
 */
const EGX1_PALETTE: Vector<'RGB'>[] = [
  [0, 0, 0], // 0 black            (shared)
  [255, 0, 0], // 1 red            (shared)
  [0, 255, 0], // 2 green          (shared)
  [0, 0, 255], // 3 blue           (shared)
  [255, 255, 0], // 4 yellow
  [255, 0, 255], // 5 magenta
  [0, 255, 255], // 6 cyan
  [255, 255, 255], // 7 white
  [128, 0, 0], // 8
  [0, 128, 0], // 9
  [0, 0, 128], // 10
  [128, 128, 0], // 11
  [128, 0, 128], // 12
  [0, 128, 128], // 13
  [128, 128, 128], // 14
  [64, 64, 64] // 15
]

/** 4-colour EGX2 palette (Mode 1 / Mode 2 alternation). */
const EGX2_PALETTE: Vector<'RGB'>[] = [
  [0, 0, 0], // 0 (shared, INK 0-1 usable on Mode 2 lines)
  [255, 255, 255], // 1 (shared)
  [255, 0, 0], // 2
  [0, 0, 255] // 3
]

function makeConfig(overrides: Partial<EGXConfig> = {}): EGXConfig {
  return {
    type: 'egx1',
    firstLineMode: 'low',
    targetHardware: 'plus',
    ditheringMode: 'floydSteinberg',
    ditheringIntensity: 100,
    ...overrides
  }
}

/** Is `pixel` exactly equal to one of the first `maxIndex+1` palette colours? */
function isInSubPalette(
  pixel: [number, number, number],
  palette: Vector<'RGB'>[],
  maxIndex: number
): boolean {
  const limit = Math.min(maxIndex + 1, palette.length)
  for (let i = 0; i < limit; i++) {
    const c = palette[i]
    if (c[0] === pixel[0] && c[1] === pixel[1] && c[2] === pixel[2]) return true
  }
  return false
}

/** Assert every output pixel uses a colour allowed on its line's sub-palette. */
function expectAllColorsInSubPalette(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Vector<'RGB'>[],
  config: EGXConfig
): void {
  for (let y = 0; y < height; y++) {
    const mode = getModeForLine(y, config)
    const maxIndex = getMaxColorIndex(mode, config.type)
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const pixel: [number, number, number] = [
        out[idx],
        out[idx + 1],
        out[idx + 2]
      ]
      expect(
        isInSubPalette(pixel, palette, maxIndex),
        `pixel (${x},${y}) ${pixel.join(',')} not in sub-palette (mode ${mode}, maxIndex ${maxIndex})`
      ).toBe(true)
    }
  }
}

const ALL_MODES = [
  'none',
  'floydSteinberg',
  'ostromoukhov',
  'atkinson',
  'bayer2x2',
  'bayer4x4',
  'bayer8x8'
] as const

describe('applyEGXDitheringByMode', () => {
  it.each(ALL_MODES)('preserves dimensions and alpha for mode %s', (mode) => {
    const width = 4
    const height = 2
    const img = makeImage(width, height, (x, y) => [x * 60, y * 60, 30, 200])
    const out = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      mode,
      1
    )
    expect(out).toBeInstanceOf(Uint8ClampedArray)
    expect(out.length).toBe(width * height * 4)
    // Alpha is always forced to 255 by every EGX ditherer.
    for (let i = 3; i < out.length; i += 4) {
      expect(out[i]).toBe(255)
    }
  })

  it.each(ALL_MODES)(
    'only emits sub-palette colours per line for mode %s',
    (mode) => {
      const width = 4
      const height = 4
      const config = makeConfig()
      // A varied gradient so the high-res (4-colour) and low-res (16-colour)
      // lines genuinely exercise their differing constraints.
      const img = makeImage(width, height, (x, y) => [
        x * 70,
        y * 70,
        (x + y) * 40,
        255
      ])
      const out = applyEGXDitheringByMode(img, EGX1_PALETTE, config, mode, 1)
      expectAllColorsInSubPalette(out, width, height, EGX1_PALETTE, config)
    }
  )

  it.each(ALL_MODES)('produces no NaN for mode %s', (mode) => {
    const width = 6
    const height = 4
    const img = makeImage(width, height, (x, y) => [
      (x * 37) % 256,
      (y * 53) % 256,
      (x * y * 19) % 256,
      255
    ])
    const out = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      mode,
      1
    )
    for (let i = 0; i < out.length; i++) {
      expect(Number.isNaN(out[i])).toBe(false)
    }
  })

  it('quantizes a uniform image to the nearest palette colour (no dithering)', () => {
    // Pure red is palette index 1 (shared, valid on every line).
    const img = makeImage(4, 4, uniform(250, 5, 5))
    const out = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'none',
      1
    )
    for (let i = 0; i < out.length; i += 4) {
      expect(out[i]).toBe(255)
      expect(out[i + 1]).toBe(0)
      expect(out[i + 2]).toBe(0)
      expect(out[i + 3]).toBe(255)
    }
  })

  it('maps a uniform red image to red on every line for ordered dithering too', () => {
    // Red is a shared colour, so even with Bayer perturbation it must remain
    // the nearest match on both the 16-colour and 4-colour lines.
    const img = makeImage(4, 4, uniform(255, 0, 0))
    const out = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'bayer4x4',
      1
    )
    for (let i = 0; i < out.length; i += 4) {
      expect([out[i], out[i + 1], out[i + 2]]).toEqual([255, 0, 0])
    }
  })

  it('restricts high-res (Mode 1) lines to INK 0-3 even when a closer Mode-0 colour exists', () => {
    // Yellow (255,255,0) is palette index 4 — available only on Mode 0 lines.
    // With firstLineMode 'low', odd lines are Mode 1 and must fall back to a
    // shared colour (0-3) instead of index 4.
    const config = makeConfig()
    const img = makeImage(4, 2, uniform(255, 255, 0))
    const out = applyEGXDitheringByMode(img, EGX1_PALETTE, config, 'none', 1)

    // Even line (y=0): Mode 0, yellow available -> exact yellow.
    const even = (0 * 4 + 0) * 4
    expect([out[even], out[even + 1], out[even + 2]]).toEqual([255, 255, 0])

    // Odd line (y=1): Mode 1, max index 3 -> must NOT be the yellow at index 4.
    const odd = (1 * 4 + 0) * 4
    const oddPixel: [number, number, number] = [
      out[odd],
      out[odd + 1],
      out[odd + 2]
    ]
    expect(oddPixel).not.toEqual([255, 255, 0])
    expect(isInSubPalette(oddPixel, EGX1_PALETTE, 3)).toBe(true)
  })

  it('enforces pixel grouping: low-res line pixel pairs share a colour', () => {
    // On Mode-0 (low-res) lines, pairs of buffer pixels must end up identical.
    // Make a checkerboard so an un-grouped result would differ across a pair.
    const width = 4
    const height = 2
    const config = makeConfig()
    const img = makeImage(width, height, (x) =>
      x % 2 === 0 ? [255, 0, 0, 255] : [0, 255, 0, 255]
    )
    const out = applyEGXDitheringByMode(img, EGX1_PALETTE, config, 'none', 1)

    // y=0 is the low-res (Mode 0) line — pairs (0,1) and (2,3) must match.
    for (let x = 0; x < width; x += 2) {
      const a = (0 * width + x) * 4
      const b = (0 * width + x + 1) * 4
      expect([out[a], out[a + 1], out[a + 2]]).toEqual([
        out[b],
        out[b + 1],
        out[b + 2]
      ])
    }
  })

  it('falls back to Floyd-Steinberg for an unknown mode name', () => {
    const img = makeImage(4, 2, (x, y) => [x * 60, y * 50, 80, 255])
    const fs = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'floydSteinberg',
      1
    )
    const unknown = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'halftone4x4',
      1
    )
    expect(Array.from(unknown)).toEqual(Array.from(fs))
  })

  it('intensity 0 vs full intensity differ on a gradient (error diffusion off)', () => {
    // With intensity 0, Floyd-Steinberg spreads no error -> equivalent to plain
    // per-line quantization; a mid-tone gradient yields a different result than
    // intensity 1 which diffuses error to neighbours.
    const width = 8
    const height = 4
    const img = makeImage(width, height, (x) => {
      const v = Math.round((x / (width - 1)) * 255)
      return [v, v, v, 255]
    })
    const zero = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'floydSteinberg',
      0
    )
    const full = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'floydSteinberg',
      1
    )
    expect(Array.from(zero)).not.toEqual(Array.from(full))
  })

  it('intensity 0 floyd-steinberg equals direct quantization (none)', () => {
    // No error diffused => each pixel quantizes against its raw value, exactly
    // like the "none" path. Use a palette-aligned gradient to keep it exact.
    const width = 8
    const height = 4
    const img = makeImage(width, height, (x) => {
      const v = Math.round((x / (width - 1)) * 255)
      return [v, 0, 0, 255]
    })
    const zero = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'floydSteinberg',
      0
    )
    const none = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'none',
      0
    )
    expect(Array.from(zero)).toEqual(Array.from(none))
  })

  it('respects firstLineMode "high" (even lines become high-res)', () => {
    const config = makeConfig({ firstLineMode: 'high' })
    // Yellow only available on Mode 0 (low-res) lines, which are now the odd ones.
    const img = makeImage(4, 2, uniform(255, 255, 0))
    const out = applyEGXDitheringByMode(img, EGX1_PALETTE, config, 'none', 1)

    // y=0 is now Mode 1 (high-res) -> cannot be yellow (index 4).
    const even: [number, number, number] = [out[0], out[1], out[2]]
    expect(even).not.toEqual([255, 255, 0])
    expectAllColorsInSubPalette(out, 4, 2, EGX1_PALETTE, config)
  })

  it('handles EGX2 (Mode 1 / Mode 2) sub-palette constraints', () => {
    const width = 4
    const height = 4
    const config = makeConfig({ type: 'egx2' })
    const img = makeImage(width, height, (x, y) => [
      x * 80,
      0,
      (y % 2) * 200,
      255
    ])
    for (const mode of ALL_MODES) {
      const out = applyEGXDitheringByMode(img, EGX2_PALETTE, config, mode, 1)
      expect(out.length).toBe(width * height * 4)
      expectAllColorsInSubPalette(out, width, height, EGX2_PALETTE, config)
    }
  })

  it('runs Ostromoukhov serpentine scan without NaN on a wide gradient', () => {
    // Width > 1 and several lines exercises both serpentine directions.
    const width = 9
    const height = 5
    const img = makeImage(width, height, (x, y) => [
      (x * 28) % 256,
      (y * 51) % 256,
      ((x + y) * 33) % 256,
      255
    ])
    const out = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig(),
      'ostromoukhov',
      1
    )
    for (let i = 0; i < out.length; i++) {
      expect(Number.isFinite(out[i])).toBe(true)
    }
    expectAllColorsInSubPalette(out, width, height, EGX1_PALETTE, makeConfig())
  })

  it('honours useDiffusionCorrection toggle without crashing', () => {
    const img = makeImage(6, 4, (x, y) => [(x * 40) % 256, y * 60, 100, 255])
    const on = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig({ useDiffusionCorrection: true }),
      'floydSteinberg',
      1
    )
    const off = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig({ useDiffusionCorrection: false }),
      'floydSteinberg',
      1
    )
    expect(on.length).toBe(off.length)
    expectAllColorsInSubPalette(on, 6, 4, EGX1_PALETTE, makeConfig())
    expectAllColorsInSubPalette(off, 6, 4, EGX1_PALETTE, makeConfig())
  })

  it('honours useOrderedCorrection toggle for Bayer dithering', () => {
    const img = makeImage(6, 4, (x, y) => [(x * 40) % 256, y * 60, 100, 255])
    const on = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig({ useOrderedCorrection: true }),
      'bayer4x4',
      1
    )
    const off = applyEGXDitheringByMode(
      img,
      EGX1_PALETTE,
      makeConfig({ useOrderedCorrection: false }),
      'bayer4x4',
      1
    )
    expect(on.length).toBe(off.length)
    expectAllColorsInSubPalette(on, 6, 4, EGX1_PALETTE, makeConfig())
    expectAllColorsInSubPalette(off, 6, 4, EGX1_PALETTE, makeConfig())
  })
})

describe('re-exported colour utilities', () => {
  it('colorDistanceSquared returns squared Euclidean RGB distance', () => {
    expect(colorDistanceSquared([0, 0, 0], [0, 0, 0])).toBe(0)
    expect(colorDistanceSquared([0, 0, 0], [1, 2, 2])).toBe(9)
    expect(colorDistanceSquared([10, 0, 0], [0, 0, 0])).toBe(100)
  })

  it('findClosestInSubset only searches up to maxIndex (inclusive)', () => {
    const palette: Vector<'RGB'>[] = [
      [0, 0, 0],
      [255, 255, 255],
      [10, 10, 10]
    ]
    // Target is closest to index 2, but with maxIndex 1 it must pick index 0.
    const limited = findClosestInSubset([12, 12, 12], palette, 1)
    expect(limited.index).toBe(0)
    expect(limited.color).toEqual([0, 0, 0])

    // With the full subset it should reach the genuine closest (index 2).
    const full = findClosestInSubset([12, 12, 12], palette, 2)
    expect(full.index).toBe(2)
    expect(full.color).toEqual([10, 10, 10])
  })
})
