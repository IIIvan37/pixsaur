import { describe, expect, it } from 'vitest'
import { CPC_MODE_CONFIG } from '@/app/store/config/types'
import { resampleCoverLinear, resampleOriginLinear } from './resize-resample'

const MODE0 = CPC_MODE_CONFIG['0'] // 160×200, ratio 2
const MODE1 = CPC_MODE_CONFIG['1'] // 320×200, ratio 1
const MODE2 = CPC_MODE_CONFIG['2'] // 640×200, ratio 0.5

function solid(width: number, height: number, rgb: [number, number, number]) {
  const img = new ImageData(width, height)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = rgb[0]
    img.data[i + 1] = rgb[1]
    img.data[i + 2] = rgb[2]
    img.data[i + 3] = 255
  }
  return img
}

describe('resampleOriginLinear', () => {
  it('downscales a 320-wide source to 160×200 with no padding', () => {
    // Left half white, right half black.
    const src = new ImageData(320, 200)
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x < 320; x++) {
        const i = (y * 320 + x) * 4
        const v = x < 160 ? 255 : 0
        src.data.set([v, v, v, 255], i)
      }
    }

    const out = resampleOriginLinear(src, MODE0, 'box', true)

    expect(out.width).toBe(160)
    expect(out.height).toBe(200)
    // Left 80 cols white, right 80 cols black (2:1 box average).
    expect(out.data[0]).toBe(255)
    expect(out.data[(79 * 4) as number]).toBe(255)
    expect(out.data[80 * 4]).toBe(0)
    expect(out.data[159 * 4]).toBe(0)
  })

  it('centers a narrow source with black horizontal padding', () => {
    const src = solid(200, 200, [255, 0, 0]) // -> destWidth 100, dx 30
    const out = resampleOriginLinear(src, MODE0, 'box', true)

    expect(out.width).toBe(160)
    expect(out.height).toBe(200)

    // Padding columns are opaque black.
    expect(Array.from(out.data.slice(0, 4))).toEqual([0, 0, 0, 255])
    expect(Array.from(out.data.slice(159 * 4, 159 * 4 + 4))).toEqual([
      0, 0, 0, 255
    ])
    // Content column is red.
    expect(Array.from(out.data.slice(30 * 4, 30 * 4 + 4))).toEqual([
      255, 0, 0, 255
    ])
  })

  it('does not pad when centerImage is false', () => {
    const src = solid(200, 200, [255, 0, 0])
    const out = resampleOriginLinear(src, MODE0, 'box', false)

    // Content starts at column 0.
    expect(Array.from(out.data.slice(0, 4))).toEqual([255, 0, 0, 255])
  })

  it('upscales horizontally for mode 2 (320 -> 640, vertical 1:1)', () => {
    // Mode 2 ratio 0.5: a 320×200 source maps to 640×200 (horizontal x2).
    const src = solid(320, 200, [12, 34, 56])
    const out = resampleOriginLinear(src, MODE2, 'box', true)

    expect(out.width).toBe(640)
    expect(out.height).toBe(200)
    // Color preserved through the linear upscale.
    expect(Array.from(out.data.slice(0, 4))).toEqual([12, 34, 56, 255])
  })

  it('maps mode 1 1:1 (no scaling) preserving content', () => {
    const src = solid(320, 200, [9, 9, 200])
    const out = resampleOriginLinear(src, MODE1, 'box', true)

    expect(out.width).toBe(320)
    expect(out.height).toBe(200)
    expect(Array.from(out.data.slice(0, 4))).toEqual([9, 9, 200, 255])
  })
})

describe('resampleCoverLinear', () => {
  it('crops to aspect and fills 160×200 for mode 0 (no padding)', () => {
    // 400×200 -> crop to 320×200 (centered), then downscale to 160×200.
    const src = solid(400, 200, [10, 200, 30])
    const out = resampleCoverLinear(src, MODE0, 'box')

    expect(out.width).toBe(160)
    expect(out.height).toBe(200)
    // Fully covered: corners are the source color, fully opaque (no black bars).
    expect(Array.from(out.data.slice(0, 4))).toEqual([10, 200, 30, 255])
    const last = (160 * 200 - 1) * 4
    expect(Array.from(out.data.slice(last, last + 4))).toEqual([
      10, 200, 30, 255
    ])
  })

  it('downscales to 320×200 for mode 1 in linear light', () => {
    // 640×400 -> fill 320×200. White/black split averages linearly (~188).
    const src = new ImageData(640, 400)
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 640; x++) {
        const v = x < 320 ? 255 : 0
        src.data.set([v, v, v, 255], (y * 640 + x) * 4)
      }
    }

    const out = resampleCoverLinear(src, MODE1, 'box')

    expect(out.width).toBe(320)
    expect(out.height).toBe(200)
    // Left half white, right half black after the 2:1 downscale.
    expect(out.data[0]).toBe(255)
    expect(out.data[319 * 4]).toBe(0)
  })
})
