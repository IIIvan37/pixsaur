import { describe, expect, it } from 'vitest'
import { resampleHorizontalLinear, resampleLinear } from './horizontal-resample'

describe('resampleHorizontalLinear', () => {
  it('averages a white/black pair in LINEAR light (~188), not gamma (128)', () => {
    // 2 px -> 1 px. The headline correctness proof: averaging 255 and 0 in
    // linear light gives mid-luminance ~188 sRGB, whereas naive gamma-space
    // averaging would give 128 (too dark).
    const src = new ImageData(2, 1)
    src.data.set([255, 255, 255, 255, 0, 0, 0, 255])

    const out = resampleHorizontalLinear(src, 1, 'box')

    expect(out.width).toBe(1)
    expect(out.height).toBe(1)
    expect(out.data[0]).toBe(188)
    expect(out.data[1]).toBe(188)
    expect(out.data[2]).toBe(188)
    expect(out.data[3]).toBe(255)
  })

  it('outputs destWidth × srcHeight dimensions', () => {
    const src = new ImageData(320, 200)
    const out = resampleHorizontalLinear(src, 160, 'lanczos2')
    expect(out.width).toBe(160)
    expect(out.height).toBe(200)
  })

  it.each(['box', 'tent', 'lanczos2'] as const)(
    'preserves a uniform color (weights normalize to 1) with %s',
    (filter) => {
      const src = new ImageData(8, 3)
      for (let i = 0; i < src.data.length; i += 4) {
        src.data[i] = 100
        src.data[i + 1] = 150
        src.data[i + 2] = 200
        src.data[i + 3] = 255
      }

      const out = resampleHorizontalLinear(src, 4, filter)

      for (let i = 0; i < out.data.length; i += 4) {
        expect(out.data[i]).toBe(100)
        expect(out.data[i + 1]).toBe(150)
        expect(out.data[i + 2]).toBe(200)
        expect(out.data[i + 3]).toBe(255)
      }
    }
  )

  it('does not darken at the edges (edge clamping preserves energy)', () => {
    // A uniform bright row must stay bright at the first and last dest columns.
    const src = new ImageData(6, 1)
    for (let i = 0; i < src.data.length; i += 4) {
      src.data.set([240, 240, 240, 255], i)
    }

    const out = resampleHorizontalLinear(src, 3, 'lanczos2')

    const last = (out.width - 1) * 4
    expect(out.data[0]).toBe(240)
    expect(out.data[last]).toBe(240)
  })

  it('vertically averages a white/black pair in LINEAR light (~188)', () => {
    // 1×2 -> 1×1: same headline proof, but on the vertical axis.
    const src = new ImageData(1, 2)
    src.data.set([255, 255, 255, 255, 0, 0, 0, 255])

    const out = resampleLinear(src, 1, 1, 'box')

    expect(out.width).toBe(1)
    expect(out.height).toBe(1)
    expect(out.data[0]).toBe(188)
  })

  it('downscales both axes to the requested size', () => {
    const src = new ImageData(320, 240)
    const out = resampleLinear(src, 160, 200, 'lanczos2')
    expect(out.width).toBe(160)
    expect(out.height).toBe(200)
  })

  it.each(['box', 'tent', 'lanczos2'] as const)(
    '2D preserves a uniform color with %s',
    (filter) => {
      const src = new ImageData(8, 8)
      for (let i = 0; i < src.data.length; i += 4) {
        src.data.set([100, 150, 200, 255], i)
      }

      const out = resampleLinear(src, 4, 4, filter)

      for (let i = 0; i < out.data.length; i += 4) {
        expect(out.data[i]).toBe(100)
        expect(out.data[i + 1]).toBe(150)
        expect(out.data[i + 2]).toBe(200)
        expect(out.data[i + 3]).toBe(255)
      }
    }
  )

  it('resamples each row independently (vertical axis untouched)', () => {
    const src = new ImageData(2, 2)
    src.data.set([
      // Row 0: white, black
      255, 255, 255, 255, 0, 0, 0, 255,
      // Row 1: black, white
      0, 0, 0, 255, 255, 255, 255, 255
    ])

    const out = resampleHorizontalLinear(src, 1, 'box')

    expect(out.width).toBe(1)
    expect(out.height).toBe(2)
    // Both rows collapse to the same linear mid-gray, independently.
    expect(out.data[0]).toBe(188)
    expect(out.data[4]).toBe(188)
  })
})
