import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { IndexBuffer } from './build-index-buffer'
import { renderIndexBufferToImageData } from './render-index-buffer'

function indexBuffer(over: Partial<IndexBuffer> = {}): IndexBuffer {
  return {
    buffer: new Uint8Array([0, 1]),
    width: 2,
    height: 1,
    palette: [
      [0, 0, 0],
      [255, 255, 255]
    ],
    ...over
  }
}

describe('renderIndexBufferToImageData', () => {
  it('resolves each pixel index against the palette (opaque RGBA)', () => {
    const image = renderIndexBufferToImageData(indexBuffer())

    expect(image.width).toBe(2)
    expect(image.height).toBe(1)
    expect(Array.from(image.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })

  it('falls back to black for an index missing from the palette', () => {
    const palette: Vector[] = [[10, 20, 30]]
    const image = renderIndexBufferToImageData(
      indexBuffer({ buffer: new Uint8Array([0, 5]), palette })
    )

    expect(Array.from(image.data)).toEqual([10, 20, 30, 255, 0, 0, 0, 255])
  })

  it('always writes full alpha', () => {
    const image = renderIndexBufferToImageData(indexBuffer())

    expect(image.data[3]).toBe(255)
    expect(image.data[7]).toBe(255)
  })
})
