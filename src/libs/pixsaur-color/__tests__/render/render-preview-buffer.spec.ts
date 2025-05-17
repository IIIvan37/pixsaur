import { renderPreviewBuffer } from '../../src/render/render-preview-buffer'

describe('renderPreviewBuffer', () => {
  it('étire un buffer 2×1 en 160×200', () => {
    const src = new Uint8ClampedArray([
      255,
      0,
      0,
      255, // rouge
      0,
      255,
      0,
      255 // vert
    ])
    const out = renderPreviewBuffer(src, 2, 1, 0)
    // coin (0,0)
    expect(out[0]).toBe(255)
    expect(out[3]).toBe(255)
    // pixel (1,0)
    expect(out[4]).toBe(255)
    // pixel (2,0) -> vert
    expect(out[8]).toBe(0)
  })
})
