import { describe, it, expect } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  createRasterPreviewImageData,
  renderPreviewWithRaster
} from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

function makePalette(overrides: Partial<Record<number, Vector>> = {}): Vector[] {
  const base: Vector[] = new Array(16).fill(0).map(() => [0, 0, 0]) as Vector[]
  for (const [k, v] of Object.entries(overrides)) {
    base[Number(k)] = v as Vector
  }
  return base
}

function rgba(r: number, g: number, b: number, a = 255) {
  return [r, g, b, a]
}

describe('renderPreviewWithRaster (CPU)', () => {
  it('applies per-line palette persistence across lines', () => {
    const width = 4
    const height = 3
    // Indices pattern: 0,1,0,1 repeated for each line
    const indexBuffer = new Uint8Array([
      0, 1, 0, 1,
      0, 1, 0, 1,
      0, 1, 0, 1
    ])

    const globalPalette = makePalette({
      0: [255, 0, 0], // red
      1: [0, 255, 0] // green
    })

    const rasterChanges: RasterChange[] = [
      // At line 1, change ink 1 to blue; should persist for lines >= 1
      { id: 'c1', line: 1, inkIndex: 1, color: [0, 0, 255] as Vector }
    ]

    const out = renderPreviewWithRaster(
      indexBuffer,
      width,
      height,
      globalPalette,
      rasterChanges
    )

    const expected = [
      // line 0 uses global palette (ink1 = green)
      ...rgba(255, 0, 0), ...rgba(0, 255, 0), ...rgba(255, 0, 0), ...rgba(0, 255, 0),
      // line 1 and 2 use updated palette (ink1 = blue) and persist
      ...rgba(255, 0, 0), ...rgba(0, 0, 255), ...rgba(255, 0, 0), ...rgba(0, 0, 255),
      ...rgba(255, 0, 0), ...rgba(0, 0, 255), ...rgba(255, 0, 0), ...rgba(0, 0, 255)
    ]

    expect(Array.from(out)).toEqual(expected)
  })

  it('handles multiple changes on the same and subsequent lines', () => {
    const width = 4
    const height = 3
    const indexBuffer = new Uint8Array([
      0, 1, 0, 1,
      0, 1, 0, 1,
      0, 1, 0, 1
    ])

    const globalPalette = makePalette({
      0: [10, 20, 30],
      1: [40, 50, 60]
    })

    const rasterChanges: RasterChange[] = [
      { id: 'l0a', line: 0, inkIndex: 0, color: [200, 100, 0] as Vector }, // ink0 -> orange-ish at line 0
      { id: 'l0b', line: 0, inkIndex: 1, color: [255, 0, 255] as Vector }, // ink1 -> magenta at line 0
      { id: 'l2', line: 2, inkIndex: 0, color: [0, 255, 255] as Vector } // ink0 -> cyan at line 2
    ]

    const out = renderPreviewWithRaster(
      indexBuffer,
      width,
      height,
      globalPalette,
      rasterChanges
    )

    const orange = [200, 100, 0]
    const magenta = [255, 0, 255]
    const cyan = [0, 255, 255]

    const expected = [
      // line 0: both changes applied immediately
      ...rgba(...orange), ...rgba(...magenta), ...rgba(...orange), ...rgba(...magenta),
      // line 1: same as line 0 (persist)
      ...rgba(...orange), ...rgba(...magenta), ...rgba(...orange), ...rgba(...magenta),
      // line 2: ink0 changed again to cyan, ink1 still magenta
      ...rgba(...cyan), ...rgba(...magenta), ...rgba(...cyan), ...rgba(...magenta)
    ]

    expect(Array.from(out)).toEqual(expected)
  })

  it('createRasterPreviewImageData returns ImageData matching raw renderer', () => {
    const width = 2
    const height = 2
    const indexBuffer = new Uint8Array([
      0, 1,
      1, 0
    ])
    const palette = makePalette({ 0: [1, 2, 3], 1: [4, 5, 6] })
    const rasterChanges: RasterChange[] = []

    const raw = renderPreviewWithRaster(indexBuffer, width, height, palette, rasterChanges)
    const img = createRasterPreviewImageData(indexBuffer, width, height, palette, rasterChanges)

    expect(img.width).toBe(width)
    expect(img.height).toBe(height)
    expect(Array.from(img.data)).toEqual(Array.from(raw))
    // Alpha should be 255 everywhere
    for (let i = 3; i < img.data.length; i += 4) {
      expect(img.data[i]).toBe(255)
    }
  })
})
