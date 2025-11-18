import { describe, expect, it } from 'vitest'
import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'
import { getVisualRegion } from '@/preview'

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
