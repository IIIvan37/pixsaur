import { describe, expect, it } from 'vitest'
import {
  generateEGXPreview,
  generateEGXPreviewMode0,
  quantizeEGX
} from './quantize-egx'
import type { EGXConfig } from './types'
import {
  getEGXOutputDimensions,
  getMaxColorIndex,
  getModeForLine
} from './types'

type RGBA = [number, number, number, number]

/** Build a flat RGBA buffer of `width`×`height`, each pixel from `fill(x, y)`. */
function makeBuffer(
  width: number,
  height: number,
  fill: (x: number, y: number) => RGBA
): Uint8ClampedArray {
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
  return data
}

const uniform =
  (r: number, g: number, b: number, a = 255) =>
  (): RGBA => [r, g, b, a]

/** Minimal valid EGX1 config (Mode 0 / Mode 1 alternation). */
const egx1Config: EGXConfig = {
  type: 'egx1',
  firstLineMode: 'low',
  targetHardware: 'classic',
  ditheringMode: 'none',
  ditheringIntensity: 0
}

/** Minimal valid EGX2 config (Mode 1 / Mode 2 alternation). */
const egx2Config: EGXConfig = {
  type: 'egx2',
  firstLineMode: 'low',
  targetHardware: 'classic',
  ditheringMode: 'none',
  ditheringIntensity: 0
}

/** Euclidean-squared distance between two RGB triples. */
function dist2(
  a: readonly number[],
  b: readonly [number, number, number]
): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

describe('quantizeEGX', () => {
  it('produces the EGX1 output dimensions regardless of input size', () => {
    const input = makeBuffer(4, 2, uniform(100, 100, 100))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const dims = getEGXOutputDimensions('egx1')
    expect(result.width).toBe(dims.width)
    expect(result.height).toBe(dims.height)
    expect(result.indexBuffer.length).toBe(dims.width * dims.height)
  })

  it('produces the EGX2 output dimensions regardless of input size', () => {
    const input = makeBuffer(4, 2, uniform(50, 60, 70))
    const result = quantizeEGX(input, 4, 2, egx2Config)
    const dims = getEGXOutputDimensions('egx2')
    expect(result.width).toBe(dims.width)
    expect(result.height).toBe(dims.height)
    expect(result.indexBuffer.length).toBe(dims.width * dims.height)
  })

  it('emits one line encoding per output line', () => {
    const input = makeBuffer(4, 2, uniform(10, 20, 30))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    expect(result.lineEncodings).toHaveLength(result.height)
    result.lineEncodings.forEach((enc, y) => {
      expect(enc.line).toBe(y)
      expect(enc.mode).toBe(getModeForLine(y, egx1Config))
    })
  })

  it('keeps every index within its line max color index (EGX1)', () => {
    // Multi-colour input so high-res lines are genuinely constrained.
    const input = makeBuffer(4, 4, (x, y) => [
      (x * 60) % 256,
      (y * 60) % 256,
      ((x + y) * 40) % 256,
      255
    ])
    const result = quantizeEGX(input, 4, 4, egx1Config)
    for (let y = 0; y < result.height; y++) {
      const mode = getModeForLine(y, egx1Config)
      const maxIndex = getMaxColorIndex(mode, 'egx1')
      for (let x = 0; x < result.width; x++) {
        const idx = result.indexBuffer[y * result.width + x]
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThanOrEqual(maxIndex)
        expect(idx).toBeLessThan(result.palette.colors.length)
      }
    }
  })

  it('keeps high-res lines within INK 0-1 for EGX2', () => {
    const input = makeBuffer(4, 4, (x, y) => [
      (x * 50) % 256,
      (y * 70) % 256,
      90,
      255
    ])
    const result = quantizeEGX(input, 4, 4, egx2Config)
    for (let y = 0; y < result.height; y++) {
      const mode = getModeForLine(y, egx2Config)
      const maxIndex = getMaxColorIndex(mode, 'egx2')
      for (let x = 0; x < result.width; x++) {
        const idx = result.indexBuffer[y * result.width + x]
        expect(idx).toBeLessThanOrEqual(maxIndex)
      }
    }
  })

  it('maps a uniform image to the single nearest palette color', () => {
    const input = makeBuffer(4, 2, uniform(0, 0, 0))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    // Every pixel should pick the palette entry closest to pure black.
    // INK 0-3 are the shared colors usable by all lines, so verify each
    // chosen index is the nearest available for its line's subset.
    const black: [number, number, number] = [0, 0, 0]
    for (let y = 0; y < result.height; y++) {
      const mode = getModeForLine(y, egx1Config)
      const maxIndex = getMaxColorIndex(mode, 'egx1')
      // findClosestInSubset scans indices 0..min(maxIndex, len-1).
      const limit = Math.min(maxIndex, result.palette.colors.length - 1)
      let best = 0
      let bestDist = Number.POSITIVE_INFINITY
      for (let i = 0; i <= limit; i++) {
        const d = dist2(Array.from(result.palette.colors[i]), black)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      }
      for (let x = 0; x < result.width; x++) {
        expect(result.indexBuffer[y * result.width + x]).toBe(best)
      }
    }
  })

  it('reports a non-negative finite total error', () => {
    const input = makeBuffer(4, 2, uniform(123, 45, 200))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    expect(Number.isFinite(result.totalError)).toBe(true)
    expect(result.totalError).toBeGreaterThanOrEqual(0)
  })

  it('respects firstLineMode by swapping line 0 mode', () => {
    const input = makeBuffer(4, 2, uniform(80, 80, 80))
    const low = quantizeEGX(input, 4, 2, {
      ...egx1Config,
      firstLineMode: 'low'
    })
    const high = quantizeEGX(input, 4, 2, {
      ...egx1Config,
      firstLineMode: 'high'
    })
    // EGX1: low->Mode0 first, high->Mode1 first.
    expect(low.lineEncodings[0].mode).toBe(0)
    expect(high.lineEncodings[0].mode).toBe(1)
  })

  it('does not resize when input already matches output dimensions', () => {
    const dims = getEGXOutputDimensions('egx1')
    const input = makeBuffer(dims.width, dims.height, uniform(255, 255, 255))
    const result = quantizeEGX(input, dims.width, dims.height, egx1Config)
    expect(result.width).toBe(dims.width)
    expect(result.height).toBe(dims.height)
    expect(result.indexBuffer.length).toBe(dims.width * dims.height)
  })
})

describe('generateEGXPreview', () => {
  it('returns an RGBA buffer matching the result dimensions', () => {
    const input = makeBuffer(4, 2, uniform(120, 60, 30))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const preview = generateEGXPreview(result)
    expect(preview.length).toBe(result.width * result.height * 4)
    expect(preview).toBeInstanceOf(Uint8ClampedArray)
  })

  it('fills the combined preview with palette colors and opaque alpha', () => {
    const input = makeBuffer(4, 2, uniform(0, 0, 0))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const preview = generateEGXPreview(result, 'combined')
    for (let i = 0; i < preview.length; i += 4) {
      expect(preview[i + 3]).toBe(255)
      expect(Number.isNaN(preview[i])).toBe(false)
      const idx = i / 4
      const color = result.palette.colors[result.indexBuffer[idx]]
      expect(preview[i]).toBe(color[0])
      expect(preview[i + 1]).toBe(color[1])
      expect(preview[i + 2]).toBe(color[2])
    }
  })

  it('paints mode-map lines with distinct colors per line type', () => {
    const input = makeBuffer(4, 2, uniform(50, 50, 50))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const preview = generateEGXPreview(result, 'modeMap')
    const width = result.width
    // Line 0 (low) -> orange-ish, line 1 (high) -> blue-ish.
    const low = [preview[0], preview[1], preview[2]]
    const highBase = (1 * width + 0) * 4
    const high = [
      preview[highBase],
      preview[highBase + 1],
      preview[highBase + 2]
    ]
    expect(low).toEqual([200, 120, 50])
    expect(high).toEqual([50, 100, 200])
    expect(low).not.toEqual(high)
  })

  it('grays out non-high lines in highLines mode', () => {
    const input = makeBuffer(4, 2, uniform(0, 0, 0))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const preview = generateEGXPreview(result, 'highLines')
    const width = result.width
    // Line 0 is a low (Mode 0) line -> grayed out.
    expect([preview[0], preview[1], preview[2]]).toEqual([128, 128, 128])
    // Line 1 is a high (Mode 1) line -> real palette color, not gray gray.
    const highIdx = (1 * width + 0) * 4
    const color = result.palette.colors[result.indexBuffer[1 * width]]
    expect(preview[highIdx]).toBe(color[0])
    expect(preview[highIdx + 1]).toBe(color[1])
    expect(preview[highIdx + 2]).toBe(color[2])
  })

  it('grays out high lines in lowLines mode', () => {
    const input = makeBuffer(4, 2, uniform(0, 0, 0))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const preview = generateEGXPreview(result, 'lowLines')
    const width = result.width
    // Line 1 (high) is grayed out.
    const highIdx = (1 * width + 0) * 4
    expect([
      preview[highIdx],
      preview[highIdx + 1],
      preview[highIdx + 2]
    ]).toEqual([128, 128, 128])
  })

  it('never emits NaN or undefined samples', () => {
    const input = makeBuffer(4, 4, (x, y) => [
      (x * 40) % 256,
      (y * 40) % 256,
      80,
      255
    ])
    const result = quantizeEGX(input, 4, 4, egx1Config)
    const preview = generateEGXPreview(result)
    for (let i = 0; i < preview.length; i++) {
      expect(preview[i]).not.toBeUndefined()
      expect(Number.isNaN(preview[i])).toBe(false)
    }
  })
})

describe('generateEGXPreviewMode0', () => {
  it('halves the width and keeps the height', () => {
    const input = makeBuffer(4, 2, uniform(90, 90, 90))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const preview = generateEGXPreviewMode0(result)
    const outWidth = Math.floor(result.width / 2)
    expect(preview.length).toBe(outWidth * result.height * 4)
  })

  it('takes every other pixel on Mode 0 lines', () => {
    const input = makeBuffer(4, 2, uniform(0, 0, 0))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const preview = generateEGXPreviewMode0(result)
    const fullWidth = result.width
    const outWidth = Math.floor(fullWidth / 2)
    // Line 0 is Mode 0: output x maps to source x*2 directly.
    for (let x = 0; x < outWidth; x++) {
      const outIdx = x * 4
      const srcColorIdx = result.indexBuffer[0 * fullWidth + x * 2]
      const color = result.palette.colors[srcColorIdx]
      expect(preview[outIdx]).toBe(color[0])
      expect(preview[outIdx + 1]).toBe(color[1])
      expect(preview[outIdx + 2]).toBe(color[2])
      expect(preview[outIdx + 3]).toBe(255)
    }
  })

  it('averages two adjacent pixels on Mode 1 lines', () => {
    const input = makeBuffer(4, 4, (x, y) => [
      (x * 50) % 256,
      (y * 50) % 256,
      100,
      255
    ])
    const result = quantizeEGX(input, 4, 4, egx1Config)
    const preview = generateEGXPreviewMode0(result)
    const fullWidth = result.width
    const outWidth = Math.floor(fullWidth / 2)
    // Line 1 is Mode 1 (high-res) -> averaged pair.
    const y = 1
    for (let x = 0; x < outWidth; x++) {
      const outIdx = (y * outWidth + x) * 4
      const c1 =
        result.palette.colors[result.indexBuffer[y * fullWidth + x * 2]]
      const c2 =
        result.palette.colors[result.indexBuffer[y * fullWidth + x * 2 + 1]]
      expect(preview[outIdx]).toBe(Math.round((c1[0] + c2[0]) / 2))
      expect(preview[outIdx + 1]).toBe(Math.round((c1[1] + c2[1]) / 2))
      expect(preview[outIdx + 2]).toBe(Math.round((c1[2] + c2[2]) / 2))
    }
  })

  it('emits opaque, finite samples only', () => {
    const input = makeBuffer(4, 4, (x, y) => [x * 30, y * 30, 60, 255])
    const result = quantizeEGX(input, 4, 4, egx1Config)
    const preview = generateEGXPreviewMode0(result)
    for (let i = 0; i < preview.length; i += 4) {
      expect(preview[i + 3]).toBe(255)
      expect(Number.isNaN(preview[i])).toBe(false)
    }
  })

  it('differs from the full-width combined preview width', () => {
    const input = makeBuffer(4, 2, uniform(200, 100, 50))
    const result = quantizeEGX(input, 4, 2, egx1Config)
    const full = generateEGXPreview(result, 'combined')
    const mode0 = generateEGXPreviewMode0(result)
    expect(mode0.length).toBeLessThan(full.length)
  })
})
