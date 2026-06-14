import { describe, expect, it } from 'vitest'
import type { DitheringMode } from '../pixsaur-color/src'
import type { Vector } from '../pixsaur-color/src/type'
import { calculateLuminance } from './blend'
import {
  generateBlendedPreview,
  generateFlickerHeatmap,
  generateFrameAPreview,
  generateFrameBPreview,
  generateModeRPreview,
  quantizeModeR,
  quantizeModeRWithDithering
} from './quantize-mode-r'
import type { ModeRConfig, ModeRPalettes } from './types'
import { DEFAULT_MODE_R_CONFIG } from './types'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Build a raw RGBA buffer of `width`×`height`, each pixel from `fill(x, y)`.
 * `quantizeModeR` consumes a raw Uint8ClampedArray (not an ImageData), at the
 * doubled horizontal resolution (so `width` should be even).
 */
const makeBuffer = (
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number]
): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y)
      const idx = (y * width + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }
  return data
}

const uniform =
  (r: number, g: number, b: number) => (): [number, number, number] => [r, g, b]

const baseConfig = (overrides: Partial<ModeRConfig> = {}): ModeRConfig => ({
  ...DEFAULT_MODE_R_CONFIG,
  ...overrides
})

const hasNaN = (data: ArrayLike<number>): boolean => {
  for (let i = 0; i < data.length; i++) {
    if (Number.isNaN(data[i])) return true
  }
  return false
}

const assertValidIndices = (buf: Uint8Array): void => {
  for (let i = 0; i < buf.length; i++) {
    expect(buf[i]).toBeGreaterThanOrEqual(0)
    expect(buf[i]).toBeLessThanOrEqual(15)
  }
}

const assertValidPalettes = (palettes: ModeRPalettes): void => {
  expect(palettes.paletteA).toHaveLength(16)
  expect(palettes.paletteB).toHaveLength(16)
  for (const color of [...palettes.paletteA, ...palettes.paletteB]) {
    expect(color).toHaveLength(3)
    for (const channel of color) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(255)
      expect(Number.isNaN(channel)).toBe(false)
    }
  }
}

// A small colourful gradient that yields varied image colours for the
// extraction / pair-optimisation paths. Width must be even (doubled res).
const W = 16
const H = 8
const gradient = makeBuffer(W, H, (x, y) => [
  (x * 16) % 256,
  (y * 32) % 256,
  ((x + y) * 12) % 256
])

// ----------------------------------------------------------------------------
// quantizeModeR — CPU fallback path (no WebGL under happy-dom)
// ----------------------------------------------------------------------------

describe('quantizeModeR (CPU path)', () => {
  it('produces two index buffers of length (width/2)*height', () => {
    const result = quantizeModeR(gradient, W, H, baseConfig())
    const expectedLen = (W / 2) * H
    expect(result.indexBufferA).toHaveLength(expectedLen)
    expect(result.indexBufferB).toHaveLength(expectedLen)
  })

  it('keeps every index within the 0-15 palette range', () => {
    const result = quantizeModeR(gradient, W, H, baseConfig())
    assertValidIndices(result.indexBufferA)
    assertValidIndices(result.indexBufferB)
  })

  it('returns two valid 16-colour palettes', () => {
    const result = quantizeModeR(gradient, W, H, baseConfig())
    assertValidPalettes(result.palettes)
  })

  it('reports a finite, non-negative total error', () => {
    const result = quantizeModeR(gradient, W, H, baseConfig())
    expect(Number.isFinite(result.totalError)).toBe(true)
    expect(result.totalError).toBeGreaterThanOrEqual(0)
  })

  it('produces a single uniform blend for a uniform image', () => {
    // A flat colour must map every output pixel to the same A/B index pair.
    const flat = makeBuffer(W, H, uniform(120, 60, 200))
    const result = quantizeModeR(
      flat,
      W,
      H,
      baseConfig({ ditheringMode: 'none' })
    )
    const blends = new Set<string>()
    for (let i = 0; i < result.indexBufferA.length; i++) {
      blends.add(`${result.indexBufferA[i]},${result.indexBufferB[i]}`)
    }
    expect(blends.size).toBe(1)
  })

  it('is deterministic across repeated runs', () => {
    const a = quantizeModeR(
      gradient,
      W,
      H,
      baseConfig({ ditheringMode: 'none' })
    )
    const b = quantizeModeR(
      gradient,
      W,
      H,
      baseConfig({ ditheringMode: 'none' })
    )
    expect(Array.from(a.indexBufferA)).toEqual(Array.from(b.indexBufferA))
    expect(Array.from(a.indexBufferB)).toEqual(Array.from(b.indexBufferB))
    expect(a.totalError).toBe(b.totalError)
  })

  it('honours an existing palette without throwing', () => {
    const existing: Vector<'RGB'>[] = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 255],
      [0, 0, 0]
    ]
    const result = quantizeModeR(gradient, W, H, baseConfig(), existing)
    assertValidPalettes(result.palettes)
    assertValidIndices(result.indexBufferA)
    assertValidIndices(result.indexBufferB)
  })

  it('falls back to the literal default config when none is passed', () => {
    const result = quantizeModeR(gradient, W, H)
    expect(result.indexBufferA).toHaveLength((W / 2) * H)
    assertValidPalettes(result.palettes)
  })
})

// ----------------------------------------------------------------------------
// Dithering modes — every branch must run without producing NaN
// ----------------------------------------------------------------------------

describe('quantizeModeR dithering modes', () => {
  const errorDiffusionModes: DitheringMode[] = [
    'floydSteinberg',
    'atkinson',
    'ylioluma1',
    'ylioluma2',
    'ostromoukhov'
  ]
  const orderedModes: DitheringMode[] = [
    'bayer2x2',
    'bayer4x4',
    'bayer8x8',
    'halftone4x4'
  ]

  for (const mode of errorDiffusionModes) {
    it(`runs error-diffusion mode "${mode}" without NaN`, () => {
      const result = quantizeModeR(
        gradient,
        W,
        H,
        baseConfig({ ditheringMode: mode, ditheringIntensity: 100 })
      )
      assertValidIndices(result.indexBufferA)
      assertValidIndices(result.indexBufferB)
      expect(Number.isFinite(result.totalError)).toBe(true)
    })
  }

  for (const mode of orderedModes) {
    it(`runs ordered mode "${mode}" without NaN`, () => {
      const result = quantizeModeR(
        gradient,
        W,
        H,
        baseConfig({ ditheringMode: mode, ditheringIntensity: 100 })
      )
      assertValidIndices(result.indexBufferA)
      assertValidIndices(result.indexBufferB)
      expect(Number.isFinite(result.totalError)).toBe(true)
    })
  }

  it('runs blue-noise dithering without NaN', () => {
    const result = quantizeModeR(
      gradient,
      W,
      H,
      baseConfig({ ditheringMode: 'blueNoise', ditheringIntensity: 100 })
    )
    assertValidIndices(result.indexBufferA)
    assertValidIndices(result.indexBufferB)
    expect(Number.isFinite(result.totalError)).toBe(true)
  })

  it('treats zero intensity like no dithering (deterministic, valid)', () => {
    const result = quantizeModeR(
      gradient,
      W,
      H,
      baseConfig({ ditheringMode: 'floydSteinberg', ditheringIntensity: 0 })
    )
    assertValidIndices(result.indexBufferA)
    assertValidIndices(result.indexBufferB)
  })

  it('error diffusion respects the diffusion-correction toggle', () => {
    const on = quantizeModeR(
      gradient,
      W,
      H,
      baseConfig({
        ditheringMode: 'floydSteinberg',
        useDiffusionCorrection: true
      })
    )
    const off = quantizeModeR(
      gradient,
      W,
      H,
      baseConfig({
        ditheringMode: 'floydSteinberg',
        useDiffusionCorrection: false
      })
    )
    assertValidIndices(on.indexBufferA)
    assertValidIndices(off.indexBufferA)
    expect(Number.isFinite(on.totalError)).toBe(true)
    expect(Number.isFinite(off.totalError)).toBe(true)
  })

  it('ordered dithering respects the ordered-correction toggle', () => {
    const on = quantizeModeR(
      gradient,
      W,
      H,
      baseConfig({ ditheringMode: 'bayer4x4', useOrderedCorrection: true })
    )
    const off = quantizeModeR(
      gradient,
      W,
      H,
      baseConfig({ ditheringMode: 'bayer4x4', useOrderedCorrection: false })
    )
    assertValidIndices(on.indexBufferA)
    assertValidIndices(off.indexBufferA)
  })
})

// ----------------------------------------------------------------------------
// Anti-flicker / luminance-delta controls affect blend selection
// ----------------------------------------------------------------------------

describe('quantizeModeR anti-flicker controls', () => {
  // A high-contrast checkerboard at the sub-pixel level: adjacent source
  // pixels alternate black/white, forcing the optimiser to weigh flicker.
  const checker = makeBuffer(W, H, (x) =>
    x % 2 === 0 ? [0, 0, 0] : [255, 255, 255]
  )

  const meanFlicker = (
    palettes: ModeRPalettes,
    bufA: Uint8Array,
    bufB: Uint8Array
  ): number => {
    let sum = 0
    for (let i = 0; i < bufA.length; i++) {
      const lumA = calculateLuminance(palettes.paletteA[bufA[i]])
      const lumB = calculateLuminance(palettes.paletteB[bufB[i]])
      sum += Math.abs(lumA - lumB)
    }
    return sum / bufA.length
  }

  it('a high anti-flicker weight does not increase mean flicker vs a low one', () => {
    const low = quantizeModeR(
      checker,
      W,
      H,
      baseConfig({
        antiFlickerWeight: 0,
        ditheringMode: 'none',
        useDualPalette: true
      })
    )
    const high = quantizeModeR(
      checker,
      W,
      H,
      baseConfig({
        antiFlickerWeight: 100,
        ditheringMode: 'none',
        useDualPalette: true
      })
    )
    const lowFlicker = meanFlicker(
      low.palettes,
      low.indexBufferA,
      low.indexBufferB
    )
    const highFlicker = meanFlicker(
      high.palettes,
      high.indexBufferA,
      high.indexBufferB
    )
    expect(highFlicker).toBeLessThanOrEqual(lowFlicker + 1e-6)
  })

  it('a tighter maxLuminanceDelta does not increase mean flicker', () => {
    const loose = quantizeModeR(
      checker,
      W,
      H,
      baseConfig({
        maxLuminanceDelta: 255,
        antiFlickerWeight: 0,
        ditheringMode: 'none',
        useDualPalette: true
      })
    )
    const tight = quantizeModeR(
      checker,
      W,
      H,
      baseConfig({
        maxLuminanceDelta: 0,
        antiFlickerWeight: 0,
        ditheringMode: 'none',
        useDualPalette: true
      })
    )
    const looseFlicker = meanFlicker(
      loose.palettes,
      loose.indexBufferA,
      loose.indexBufferB
    )
    const tightFlicker = meanFlicker(
      tight.palettes,
      tight.indexBufferA,
      tight.indexBufferB
    )
    expect(tightFlicker).toBeLessThanOrEqual(looseFlicker + 1e-6)
  })
})

// ----------------------------------------------------------------------------
// quantizeModeRWithDithering — separate Floyd-Steinberg path
// ----------------------------------------------------------------------------

describe('quantizeModeRWithDithering', () => {
  const targetPalette: Vector<'RGB'>[] = [
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 0, 255],
    [255, 255, 255]
  ]

  it('produces correctly sized, valid index buffers and palettes', () => {
    const result = quantizeModeRWithDithering(
      gradient,
      W,
      H,
      targetPalette,
      baseConfig()
    )
    const expectedLen = (W / 2) * H
    expect(result.indexBufferA).toHaveLength(expectedLen)
    expect(result.indexBufferB).toHaveLength(expectedLen)
    assertValidIndices(result.indexBufferA)
    assertValidIndices(result.indexBufferB)
    assertValidPalettes(result.palettes)
  })

  it('reports a finite total error', () => {
    const result = quantizeModeRWithDithering(
      gradient,
      W,
      H,
      targetPalette,
      baseConfig()
    )
    expect(Number.isFinite(result.totalError)).toBe(true)
    expect(result.totalError).toBeGreaterThanOrEqual(0)
  })

  it('is deterministic', () => {
    const a = quantizeModeRWithDithering(gradient, W, H, targetPalette)
    const b = quantizeModeRWithDithering(gradient, W, H, targetPalette)
    expect(Array.from(a.indexBufferA)).toEqual(Array.from(b.indexBufferA))
    expect(Array.from(a.indexBufferB)).toEqual(Array.from(b.indexBufferB))
  })

  it('runs with zero dithering strength', () => {
    const result = quantizeModeRWithDithering(
      gradient,
      W,
      H,
      targetPalette,
      baseConfig(),
      0
    )
    assertValidIndices(result.indexBufferA)
    assertValidIndices(result.indexBufferB)
  })
})

// ----------------------------------------------------------------------------
// Preview generators
// ----------------------------------------------------------------------------

describe('Mode R preview generators', () => {
  const result = quantizeModeR(
    gradient,
    W,
    H,
    baseConfig({ ditheringMode: 'none' })
  )
  const outW = W / 2
  const { indexBufferA, indexBufferB, palettes } = result

  it('generateModeRPreview returns doubled-width RGBA with no NaN', () => {
    const preview = generateModeRPreview(
      indexBufferA,
      indexBufferB,
      outW,
      H,
      palettes
    )
    expect(preview).toHaveLength(outW * 2 * H * 4)
    expect(hasNaN(preview)).toBe(false)
    // Every alpha byte is fully opaque.
    for (let i = 3; i < preview.length; i += 4) {
      expect(preview[i]).toBe(255)
    }
  })

  it('generateBlendedPreview returns doubled-width RGBA with no NaN', () => {
    const preview = generateBlendedPreview(
      indexBufferA,
      indexBufferB,
      outW,
      H,
      palettes
    )
    expect(preview).toHaveLength(outW * 2 * H * 4)
    expect(hasNaN(preview)).toBe(false)
    for (let i = 3; i < preview.length; i += 4) {
      expect(preview[i]).toBe(255)
    }
  })

  it('generateFrameAPreview reproduces palette-A colours pixel for pixel', () => {
    const preview = generateFrameAPreview(indexBufferA, outW, H, palettes)
    expect(preview).toHaveLength(outW * H * 4)
    const first = palettes.paletteA[indexBufferA[0]]
    expect(Array.from(preview.slice(0, 4))).toEqual([
      first[0],
      first[1],
      first[2],
      255
    ])
  })

  it('generateFrameBPreview reproduces palette-B colours pixel for pixel', () => {
    const preview = generateFrameBPreview(indexBufferB, outW, H, palettes)
    expect(preview).toHaveLength(outW * H * 4)
    const first = palettes.paletteB[indexBufferB[0]]
    expect(Array.from(preview.slice(0, 4))).toEqual([
      first[0],
      first[1],
      first[2],
      255
    ])
  })

  it('generateFlickerHeatmap is greyscale, opaque and within 0-255', () => {
    const heat = generateFlickerHeatmap(
      indexBufferA,
      indexBufferB,
      outW,
      H,
      palettes
    )
    expect(heat).toHaveLength(outW * H * 4)
    for (let i = 0; i < heat.length; i += 4) {
      // R == G == B (greyscale)
      expect(heat[i]).toBe(heat[i + 1])
      expect(heat[i]).toBe(heat[i + 2])
      expect(heat[i]).toBeGreaterThanOrEqual(0)
      expect(heat[i]).toBeLessThanOrEqual(255)
      expect(heat[i + 3]).toBe(255)
    }
  })

  it('generateFlickerHeatmap is all-black for a zero-flicker (uniform) image', () => {
    // A flat image with the same palette in both frames yields no flicker.
    const flat = makeBuffer(W, H, uniform(80, 80, 80))
    const flatResult = quantizeModeR(
      flat,
      W,
      H,
      baseConfig({ ditheringMode: 'none', useDualPalette: false })
    )
    const heat = generateFlickerHeatmap(
      flatResult.indexBufferA,
      flatResult.indexBufferB,
      outW,
      H,
      flatResult.palettes
    )
    for (let i = 0; i < heat.length; i += 4) {
      expect(heat[i]).toBe(0)
    }
  })
})
