import { describe, expect, it, vi } from 'vitest'
import { getDistanceFn } from '../../metric/distance'
import type { Vector } from '../../type'
import {
  applyBlueNoiseDither,
  applyOstromoukhovDither,
  mapAndDither,
  mapAndDitherWithDynamicPalette
} from '../map-and-dither'

// Mock logger to avoid console output in tests
vi.mock('@/core', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...(actual as any),
    logger: {
      ...(actual.logger || {}),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    }
  }
})

const distFn = getDistanceFn('RGB', 'euclidean')

// Black / white palette, reused across most cases.
const bwPaletteCS = [
  new Float32Array([0, 0, 0]),
  new Float32Array([255, 255, 255])
]
const bwPaletteOut = [
  new Uint8ClampedArray([0, 0, 0, 255]),
  new Uint8ClampedArray([255, 255, 255, 255])
]

const bwPalette: Vector[] = [
  [0, 0, 0],
  [255, 255, 255]
]

const rgbPalette: Vector[] = [
  [0, 0, 0],
  [255, 255, 255],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255]
]

/** Build a width*height RGBA image filled with a single gray level. */
function makeGrayImage(
  width: number,
  height: number,
  value: number
): Uint8ClampedArray {
  const img = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < img.length; i += 4) {
    img[i] = value
    img[i + 1] = value
    img[i + 2] = value
    img[i + 3] = 255
  }
  return img
}

/** True if every RGB pixel in `out` is one of the colors in `palette`. */
function allPixelsInPalette(
  out: Uint8ClampedArray,
  palette: Vector[]
): boolean {
  const keys = new Set(palette.map((c) => `${c[0]},${c[1]},${c[2]}`))
  for (let i = 0; i < out.length; i += 4) {
    if (!keys.has(`${out[i]},${out[i + 1]},${out[i + 2]}`)) return false
  }
  return true
}

/** True if no value in the array is NaN. */
function hasNoNaN(out: Uint8ClampedArray): boolean {
  for (let i = 0; i < out.length; i++) {
    if (Number.isNaN(out[i])) return false
  }
  return true
}

describe('applyBlueNoiseDither (direct)', () => {
  it('produces palette-only, NaN-free output of the right length', () => {
    const bufCS = new Float32Array([
      100, 100, 100, 150, 150, 150, 200, 200, 200, 50, 50, 50
    ])
    const result = applyBlueNoiseDither({
      bufCS,
      width: 2,
      height: 2,
      paletteCS: bwPaletteCS,
      paletteOut: bwPaletteOut,
      intensity: 0.8,
      distFn,
      correction: { enabled: true }
    })

    expect(result).toBeInstanceOf(Uint8ClampedArray)
    expect(result.length).toBe(16)
    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
    // every alpha channel is opaque
    for (let i = 3; i < result.length; i += 4) {
      expect(result[i]).toBe(255)
    }
  })

  it('passes exact palette matches through untouched (correction enabled)', () => {
    // Both pixels already equal palette colors -> early-continue path.
    const bufCS = new Float32Array([0, 0, 0, 255, 255, 255])
    const result = applyBlueNoiseDither({
      bufCS,
      width: 2,
      height: 1,
      paletteCS: bwPaletteCS,
      paletteOut: bwPaletteOut,
      intensity: 1,
      distFn,
      correction: { enabled: true }
    })

    expect(Array.from(result)).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })

  it('honors correction disabled (non-adaptive amplitude branch)', () => {
    const bufCS = new Float32Array([128, 128, 128, 128, 128, 128])
    const result = applyBlueNoiseDither({
      bufCS,
      width: 2,
      height: 1,
      paletteCS: bwPaletteCS,
      paletteOut: bwPaletteOut,
      intensity: 0.5,
      distFn,
      correction: { enabled: false }
    })

    expect(result.length).toBe(8)
    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })

  it('falls back to default correction when option omitted', () => {
    const bufCS = new Float32Array([120, 120, 120])
    const result = applyBlueNoiseDither({
      bufCS,
      width: 1,
      height: 1,
      paletteCS: bwPaletteCS,
      paletteOut: bwPaletteOut,
      intensity: 0.6,
      distFn
    })

    expect(result.length).toBe(4)
    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
  })
})

describe('applyOstromoukhovDither (direct)', () => {
  it('produces palette-only, NaN-free output (serpentine over 2 lines)', () => {
    // 3x2 forces both left-to-right and right-to-left scan lines.
    const bufCS = new Float32Array(3 * 2 * 3).fill(128)
    const result = applyOstromoukhovDither({
      bufCS,
      width: 3,
      height: 2,
      paletteCS: bwPaletteCS,
      paletteOut: bwPaletteOut,
      distFn,
      intensity: 0.8,
      correction: { enabled: true, errorClamp: 64 }
    })

    expect(result).toBeInstanceOf(Uint8ClampedArray)
    expect(result.length).toBe(24)
    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })

  it('runs with correction disabled (no clamping)', () => {
    const bufCS = new Float32Array([10, 10, 10, 245, 245, 245])
    const result = applyOstromoukhovDither({
      bufCS,
      width: 2,
      height: 1,
      paletteCS: bwPaletteCS,
      paletteOut: bwPaletteOut,
      distFn,
      intensity: 1,
      correction: { enabled: false, errorClamp: 64 }
    })

    expect(result.length).toBe(8)
    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })
})

describe('mapAndDither — blueNoise & ostromoukhov routing', () => {
  it('routes blueNoise mode through the dispatch table', () => {
    const img = makeGrayImage(4, 4, 130)
    const result = mapAndDither(
      img,
      4,
      4,
      rgbPalette,
      { mode: 'blueNoise', intensity: 0.7 },
      'RGB'
    )

    expect(result.length).toBe(4 * 4 * 4)
    expect(allPixelsInPalette(result, rgbPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })

  it('routes ostromoukhov mode through the dispatch table', () => {
    const img = makeGrayImage(4, 4, 130)
    const result = mapAndDither(
      img,
      4,
      4,
      rgbPalette,
      { mode: 'ostromoukhov', intensity: 0.7 },
      'RGB'
    )

    expect(result.length).toBe(4 * 4 * 4)
    expect(allPixelsInPalette(result, rgbPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })

  it('honors useOrderedCorrection: false for blueNoise', () => {
    const img = makeGrayImage(3, 3, 100)
    const result = mapAndDither(
      img,
      3,
      3,
      bwPalette,
      { mode: 'blueNoise', intensity: 0.5, useOrderedCorrection: false },
      'RGB'
    )

    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })

  it('honors useDiffusionCorrection: false for ostromoukhov', () => {
    const img = makeGrayImage(3, 3, 100)
    const result = mapAndDither(
      img,
      3,
      3,
      bwPalette,
      { mode: 'ostromoukhov', intensity: 0.5, useDiffusionCorrection: false },
      'RGB'
    )

    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })
})

describe('mapAndDitherWithDynamicPalette — blueNoise variant', () => {
  it('applies blue-noise dithering with a per-line palette', () => {
    const img = makeGrayImage(4, 4, 128)
    const result = mapAndDitherWithDynamicPalette(
      img,
      4,
      4,
      () => bwPalette,
      { mode: 'blueNoise', intensity: 0.6 },
      'RGB'
    )

    expect(result.length).toBe(4 * 4 * 4)
    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })

  it('picks the right palette per line (blueNoise dynamic)', () => {
    // 4x2 gray image; line 0 -> black/red, line 1 -> black/blue.
    const img = makeGrayImage(4, 2, 128)
    const getPaletteForLine = (y: number): Vector[] =>
      y === 0
        ? [
            [0, 0, 0],
            [255, 0, 0]
          ]
        : [
            [0, 0, 0],
            [0, 0, 255]
          ]

    const result = mapAndDitherWithDynamicPalette(
      img,
      4,
      2,
      getPaletteForLine,
      { mode: 'blueNoise', intensity: 0.9 },
      'RGB'
    )

    expect(result.length).toBe(32)
    // Line 0: only black or red allowed.
    for (let x = 0; x < 4; x++) {
      const idx = x * 4
      const isBlack =
        result[idx] === 0 && result[idx + 1] === 0 && result[idx + 2] === 0
      const isRed =
        result[idx] === 255 && result[idx + 1] === 0 && result[idx + 2] === 0
      expect(isBlack || isRed).toBe(true)
    }
    // Line 1: only black or blue allowed.
    for (let x = 0; x < 4; x++) {
      const idx = (4 + x) * 4
      const isBlack =
        result[idx] === 0 && result[idx + 1] === 0 && result[idx + 2] === 0
      const isBlue =
        result[idx] === 0 && result[idx + 1] === 0 && result[idx + 2] === 255
      expect(isBlack || isBlue).toBe(true)
    }
  })

  it('honors useOrderedCorrection: false for blueNoise dynamic palette', () => {
    const img = makeGrayImage(3, 3, 100)
    const result = mapAndDitherWithDynamicPalette(
      img,
      3,
      3,
      () => bwPalette,
      { mode: 'blueNoise', intensity: 0.5, useOrderedCorrection: false },
      'RGB'
    )

    expect(allPixelsInPalette(result, bwPalette)).toBe(true)
    expect(hasNoNaN(result)).toBe(true)
  })
})

describe('intensity affects ordered-dither output', () => {
  it('different intensities yield different blue-noise results on a midtone image', () => {
    // A flat midtone field is sensitive to threshold amplitude: changing
    // intensity must change at least one pixel decision.
    const img = makeGrayImage(8, 8, 128)
    const low = mapAndDither(
      img,
      8,
      8,
      bwPalette,
      { mode: 'blueNoise', intensity: 0.1 },
      'RGB'
    )
    const high = mapAndDither(
      img,
      8,
      8,
      bwPalette,
      { mode: 'blueNoise', intensity: 1 },
      'RGB'
    )

    let differs = false
    for (let i = 0; i < low.length; i++) {
      if (low[i] !== high[i]) {
        differs = true
        break
      }
    }
    expect(differs).toBe(true)
  })
})
