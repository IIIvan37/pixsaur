import { describe, expect, it } from 'vitest'
import { CPC_MODE_CONFIG } from '@/app/store/config/types'
import { resampleMode0Origin } from './mode0-resample'

const MODE0 = CPC_MODE_CONFIG['0'] // 160×200, ratio 2

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

describe('resampleMode0Origin', () => {
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

    const out = resampleMode0Origin(src, MODE0, 'box', true)

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
    const out = resampleMode0Origin(src, MODE0, 'box', true)

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
    const out = resampleMode0Origin(src, MODE0, 'box', false)

    // Content starts at column 0.
    expect(Array.from(out.data.slice(0, 4))).toEqual([255, 0, 0, 255])
  })
})
