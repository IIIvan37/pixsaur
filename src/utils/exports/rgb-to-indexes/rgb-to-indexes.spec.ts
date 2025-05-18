import { rgbToIndexBufferExact } from './rgb-to-indexes'

describe('rgbToIndexBufferExact', () => {
  it('returns correct indices for exact palette matches', () => {
    // Palette: Red, Green, Blue
    const palette = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ] as [number, number, number][]
    // RGBA buffer: Red, Green, Blue pixels (alpha ignored)
    const rgba = new Uint8ClampedArray([
      255,
      0,
      0,
      255, // Red
      0,
      255,
      0,
      255, // Green
      0,
      0,
      255,
      255 // Blue
    ])
    const result = rgbToIndexBufferExact(rgba, palette)
    expect(Array.from(result)).toEqual([0, 1, 2])
  })

  it('throws if a color is not found in the palette', () => {
    const palette = [
      [255, 0, 0],
      [0, 255, 0]
    ] as [number, number, number][]
    // RGBA buffer: Red, Green, Blue (Blue not in palette)
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255
    ])
    expect(() => rgbToIndexBufferExact(rgba, palette)).toThrow(
      'Pixel RGB [0, 0, 255] non trouvé dans la palette.'
    )
  })

  it('works with an empty buffer', () => {
    const palette = [[1, 2, 3]] as [number, number, number][]
    const rgba = new Uint8ClampedArray([])
    const result = rgbToIndexBufferExact(rgba, palette)
    expect(Array.from(result)).toEqual([])
  })
})
