import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  type BuildIndexBufferInput,
  buildIndexBuffer
} from './build-index-buffer'

/** Build an RGBA ImageData from a flat list of [r,g,b] pixels (alpha=255). */
function imageFromPixels(
  width: number,
  height: number,
  pixels: Vector[]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  })
  return new ImageData(data, width, height)
}

function baseInput(
  over: Partial<BuildIndexBufferInput> = {}
): BuildIndexBufferInput {
  return {
    previewImage: imageFromPixels(2, 1, [
      [0, 0, 0],
      [255, 255, 255]
    ]),
    exportPalette: [
      [0, 0, 0],
      [255, 255, 255]
    ],
    ...over
  }
}

describe('buildIndexBuffer', () => {
  it('maps each pixel to its exact palette index', () => {
    const result = buildIndexBuffer(baseInput())

    if (!result.ok) throw new Error('expected ok')
    expect(Array.from(result.indexBuffer.buffer)).toEqual([0, 1])
    expect(result.indexBuffer.width).toBe(2)
    expect(result.indexBuffer.height).toBe(1)
  })

  it('fails with an explicit error on an empty export palette', () => {
    const result = buildIndexBuffer(baseInput({ exportPalette: [] }))

    expect(result).toEqual({ ok: false, error: 'empty export palette' })
  })

  it('replaces ignored slots with the darkest valid color in the returned palette', () => {
    const palette: Vector[] = [
      [100, 100, 100],
      [-1, -1, -1],
      [10, 10, 10]
    ]

    const result = buildIndexBuffer(baseInput({ exportPalette: palette }))

    if (!result.ok) throw new Error('expected ok')
    // darkest valid color is [10,10,10]; the ignored slot is swapped for it.
    expect(result.indexBuffer.palette).toEqual([
      [100, 100, 100],
      [10, 10, 10],
      [10, 10, 10]
    ])
  })

  it('falls back to the darkest color for a pixel absent from the palette', () => {
    // green pixel is not in a black/white palette → maps to darkest ([0,0,0] = 0)
    const result = buildIndexBuffer(
      baseInput({ previewImage: imageFromPixels(1, 1, [[0, 255, 0]]) })
    )

    if (!result.ok) throw new Error('expected ok')
    expect(Array.from(result.indexBuffer.buffer)).toEqual([0])
  })
})
