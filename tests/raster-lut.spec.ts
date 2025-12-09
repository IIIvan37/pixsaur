import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { renderPreviewWithRaster } from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

function makePalette(
  overrides: Partial<Record<number, Vector>> = {}
): Vector[] {
  const base: Vector[] = new Array(16).fill(0).map(() => [0, 0, 0]) as Vector[]
  for (const [k, v] of Object.entries(overrides)) base[Number(k)] = v as Vector
  return base
}

function rgba(r: number, g: number, b: number, a = 255) {
  return [r, g, b, a]
}

describe('Raster LUT semantics via CPU renderer', () => {
  it('no raster changes → all lines use the global palette', () => {
    const width = 3
    const height = 3
    const idx = new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1, 0])
    const palette = makePalette({ 0: [10, 20, 30], 1: [200, 150, 100] })
    const out = renderPreviewWithRaster(idx, width, height, palette, [])

    const line0 = [
      ...rgba(10, 20, 30),
      ...rgba(200, 150, 100),
      ...rgba(10, 20, 30)
    ]
    const line1 = [
      ...rgba(200, 150, 100),
      ...rgba(10, 20, 30),
      ...rgba(200, 150, 100)
    ]
    const expected = [...line0, ...line1, ...line0]
    expect(Array.from(out)).toEqual(expected)
  })

  it('last-line changes affect only that line and persist afterwards (no further lines)', () => {
    const width = 4
    const height = 2
    const idx = new Uint8Array([0, 1, 2, 3, 0, 1, 2, 3])
    const palette = makePalette({
      0: [0, 0, 0],
      1: [10, 10, 10],
      2: [20, 20, 20],
      3: [30, 30, 30]
    })
    const changes: RasterChange[] = [
      { id: 'last', line: 1, inkIndex: 2, color: [255, 0, 0] as Vector }
    ]
    const out = renderPreviewWithRaster(idx, width, height, palette, changes)

    // line 0: global palette
    const line0 = [
      ...rgba(0, 0, 0),
      ...rgba(10, 10, 10),
      ...rgba(20, 20, 20),
      ...rgba(30, 30, 30)
    ]
    // line 1: ink 2 changed to red
    const line1 = [
      ...rgba(0, 0, 0),
      ...rgba(10, 10, 10),
      ...rgba(255, 0, 0),
      ...rgba(30, 30, 30)
    ]
    expect(Array.from(out)).toEqual([...line0, ...line1])
  })

  it('multiple changes on same line override correctly and persist', () => {
    const width = 2
    const height = 3
    const idx = new Uint8Array([0, 1, 0, 1, 0, 1])
    const palette = makePalette({ 0: [1, 1, 1], 1: [2, 2, 2] })
    const changes: RasterChange[] = [
      { id: 'a', line: 1, inkIndex: 0, color: [9, 9, 9] as Vector },
      { id: 'b', line: 1, inkIndex: 0, color: [100, 0, 0] as Vector }, // overrides previous same-line change for ink0
      { id: 'c', line: 1, inkIndex: 1, color: [0, 100, 0] as Vector }
    ]
    const out = renderPreviewWithRaster(idx, width, height, palette, changes)

    const line0 = [...rgba(1, 1, 1), ...rgba(2, 2, 2)]
    const line1 = [...rgba(100, 0, 0), ...rgba(0, 100, 0)]
    // line 2 persists line 1 changes
    expect(Array.from(out)).toEqual([...line0, ...line1, ...line1])
  })
})
