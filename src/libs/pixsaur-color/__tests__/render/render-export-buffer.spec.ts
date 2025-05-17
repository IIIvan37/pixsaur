import { renderExportBuffer } from '../../src/render/render-export-buffer'

describe('renderExportBuffer', () => {
  it('duplique un buffer 1×1 en 160×200', () => {
    const src = new Uint8ClampedArray([10, 20, 30, 255])
    const out = renderExportBuffer(src, 1, 1, 0)
    // longueur
    expect(out.length).toBe(160 * 200 * 4)
    // coin (0,0)
    expect(out[0]).toBe(10)
    // coin (159,199)
    const idx = ((200 - 1) * 160 + (160 - 1)) * 4
    expect(out[idx]).toBe(10)
  })
})
