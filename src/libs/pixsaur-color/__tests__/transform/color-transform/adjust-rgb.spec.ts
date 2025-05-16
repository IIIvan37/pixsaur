import { adjustRGBChannels } from '@/libs/pixsaur-color/src/transform/color-transform/adjust-rgb'
import { describe, it, expect } from 'bun:test'

describe('adjustRGBChannels', () => {
  const src = new Uint8ClampedArray([10, 20, 30, 255, 100, 150, 200, 128])

  it('augmente R, laisse G, diminue B', () => {
    const out = adjustRGBChannels(src, 2, 1, 0.5)
    // pixel 0: [20,20,15,255]
    expect(out[0]).toBe(20)
    expect(out[1]).toBe(20)
    expect(out[2]).toBe(15)
    expect(out[3]).toBe(255)
    // pixel 1: [200,150,100,128]
    expect(out[4]).toBe(200)
    expect(out[5]).toBe(150)
    expect(out[6]).toBe(100)
    expect(out[7]).toBe(128)
  })

  it('clamp aux bornes 0–255', () => {
    const src2 = new Uint8ClampedArray([200, 200, 200, 255])
    const out2 = adjustRGBChannels(src2, 2, 2, 2)
    expect(out2[0]).toBe(255)
    expect(out2[1]).toBe(255)
    expect(out2[2]).toBe(255)
    expect(out2[3]).toBe(255)
  })
})
