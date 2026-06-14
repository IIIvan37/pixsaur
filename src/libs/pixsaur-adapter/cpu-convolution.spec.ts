import { describe, expect, it } from 'vitest'
import {
  applyChromaKey,
  applyConvolution3x3,
  applyConvolutionFilters,
  applyMedianFilter,
  applySobelEdgeDetection
} from './cpu-convolution'

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

const IDENTITY_KERNEL = [0, 0, 0, 0, 1, 0, 0, 0, 0]
const BOX_BLUR_KERNEL = new Array(9).fill(1 / 9)

describe('applyConvolution3x3', () => {
  it('returns an identical copy when strength is 0', () => {
    const img = makeImage(2, 2, (x, y) => [x * 50, y * 50, 10, 255])
    const out = applyConvolution3x3(img, BOX_BLUR_KERNEL, 0)
    expect(out.width).toBe(2)
    expect(out.height).toBe(2)
    expect(Array.from(out.data)).toEqual(Array.from(img.data))
    expect(out.data).not.toBe(img.data) // a copy, not the same buffer
  })

  it('is a no-op with the identity kernel at full strength', () => {
    const img = makeImage(3, 3, (x, y) => [x * 30, y * 30, 100, 200])
    const out = applyConvolution3x3(img, IDENTITY_KERNEL, 1)
    expect(Array.from(out.data)).toEqual(Array.from(img.data))
  })

  it('leaves a uniform image unchanged under a box blur', () => {
    const img = makeImage(3, 3, uniform(100, 150, 200))
    const out = applyConvolution3x3(img, BOX_BLUR_KERNEL, 1)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(100)
      expect(out.data[i + 1]).toBe(150)
      expect(out.data[i + 2]).toBe(200)
    }
  })

  it('preserves the alpha channel', () => {
    const img = makeImage(2, 2, (x) => [x * 80, 0, 0, 123])
    const out = applyConvolution3x3(img, BOX_BLUR_KERNEL, 1)
    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(123)
    }
  })
})

describe('applyConvolutionFilters', () => {
  it('returns the same image when both filters are off', () => {
    const img = makeImage(2, 2, uniform(10, 20, 30))
    expect(applyConvolutionFilters(img, 0, 0)).toBe(img)
  })

  it('runs the blur path and keeps dimensions', () => {
    const img = makeImage(4, 4, (x, y) => [(x + y) * 20, 50, 50, 255])
    const out = applyConvolutionFilters(img, 0, 1)
    expect(out.width).toBe(4)
    expect(out.height).toBe(4)
    expect(out).not.toBe(img)
  })

  it('runs the sharpen path and keeps dimensions', () => {
    const img = makeImage(4, 4, (x, y) => [(x + y) * 20, 50, 50, 255])
    const out = applyConvolutionFilters(img, 1, 0)
    expect(out.width).toBe(4)
    expect(out.height).toBe(4)
  })
})

describe('applyMedianFilter', () => {
  it('returns the same image for radius <= 0', () => {
    const img = makeImage(3, 3, uniform(50, 50, 50))
    expect(applyMedianFilter(img, 0)).toBe(img)
    expect(applyMedianFilter(img, -2)).toBe(img)
  })

  it('removes an isolated outlier pixel', () => {
    const img = makeImage(3, 3, (x, y) =>
      x === 1 && y === 1 ? [255, 255, 255, 255] : [100, 100, 100, 255]
    )
    const out = applyMedianFilter(img, 1)
    const centerIdx = (1 * 3 + 1) * 4
    // Median of eight 100s and one 255 is 100 — the spike is gone.
    expect(out.data[centerIdx]).toBe(100)
    expect(out.data[centerIdx + 1]).toBe(100)
    expect(out.data[centerIdx + 2]).toBe(100)
  })

  it('clamps the radius and preserves alpha + dimensions', () => {
    const img = makeImage(3, 3, uniform(40, 40, 40, 77))
    const out = applyMedianFilter(img, 5) // clamped to 3
    expect(out.width).toBe(3)
    expect(out.height).toBe(3)
    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(77)
    }
  })
})

describe('applySobelEdgeDetection', () => {
  it('returns the same image when strength is 0', () => {
    const img = makeImage(3, 3, uniform(120, 120, 120))
    expect(applySobelEdgeDetection(img, 0)).toBe(img)
  })

  it('reports no edges on a uniform image', () => {
    const img = makeImage(3, 3, uniform(120, 80, 40))
    const out = applySobelEdgeDetection(img, 1)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(0)
      expect(out.data[i + 1]).toBe(0)
      expect(out.data[i + 2]).toBe(0)
    }
  })

  it('detects a vertical edge', () => {
    // Left half black, right half white -> a strong edge down the middle.
    const img = makeImage(4, 3, (x) =>
      x < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]
    )
    const out = applySobelEdgeDetection(img, 1)
    // The column straddling the transition must light up somewhere.
    let maxMag = 0
    for (let i = 0; i < out.data.length; i += 4)
      maxMag = Math.max(maxMag, out.data[i])
    expect(maxMag).toBeGreaterThan(0)
  })
})

describe('applyChromaKey', () => {
  it('replaces pixels matching the key within tolerance', () => {
    const img = makeImage(2, 1, (x) =>
      x === 0 ? [0, 255, 0, 255] : [200, 10, 10, 255]
    )
    const out = applyChromaKey(img, [0, 255, 0], 10)
    // Pixel 0 (the key colour) becomes the default replacement (black).
    expect(Array.from(out.data.slice(0, 4))).toEqual([0, 0, 0, 255])
    // Pixel 1 is far from the key -> untouched.
    expect(Array.from(out.data.slice(4, 8))).toEqual([200, 10, 10, 255])
  })

  it('honours a custom replacement colour and preserves alpha', () => {
    const img = makeImage(1, 1, () => [10, 10, 10, 180])
    const out = applyChromaKey(img, [10, 10, 10], 0, [50, 60, 70])
    expect(Array.from(out.data)).toEqual([50, 60, 70, 180])
  })

  it('only matches exact colours when tolerance is 0', () => {
    const img = makeImage(1, 1, () => [10, 10, 12, 255])
    // distance^2 = 4 > 0 -> not replaced
    const out = applyChromaKey(img, [10, 10, 10], 0, [0, 0, 0])
    expect(Array.from(out.data)).toEqual([10, 10, 12, 255])
  })
})
