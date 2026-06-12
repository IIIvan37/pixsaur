import { describe, expect, it } from 'vitest'
import { CPC_MODE_CONFIG } from '@/domain/cpc'
import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'
import { getVisualRegion, getVisualRegionNormalized } from '@/preview'

describe('getVisualRegion', () => {
  it('returns a region', () => {
    const src = new ImageData(100, 100)
    const selection: Selection = { sx: 0, sy: 0, width: 10, height: 10 }
    const region = getVisualRegion(src, selection)
    expect(region).toBeDefined()
    expect(region.width).toBe(10)
    expect(region.height).toBe(10)
  })
})

describe('getVisualRegionNormalized', () => {
  it('uses linear-light resampling for mode 0 when a filter is provided', () => {
    // 320×100 mode 0 -> scaledW 160, scaledH 100 (horizontal 2:1, vertical 1:1).
    // Left half white, right half black.
    const src = new ImageData(320, 100)
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 320; x++) {
        const v = x < 160 ? 255 : 0
        src.data.set([v, v, v, 255], (y * 320 + x) * 4)
      }
    }

    const out = getVisualRegionNormalized(src, CPC_MODE_CONFIG['0'], 'box')

    expect(out).not.toBeNull()
    expect(out?.width).toBe(160)
    expect(out?.height).toBe(100)
    // Real linear-resampled pixels: left white, right black.
    expect(out?.data[0]).toBe(255)
    expect(out?.data[79 * 4]).toBe(255)
    expect(out?.data[80 * 4]).toBe(0)
  })
})
