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

  it('uses darkest color fallback when enabled', () => {
    const palette = [
      [255, 255, 255], // White - bright
      [128, 128, 128], // Gray - medium
      [0, 0, 0] // Black - darkest (index 2)
    ] as [number, number, number][]

    // Missing red color in palette
    const rgba = new Uint8ClampedArray([
      255,
      0,
      0,
      255, // Red - not in palette
      0,
      0,
      0,
      255 // Black - in palette at index 2
    ])

    const result = rgbToIndexBufferExact(rgba, palette, true, true)
    expect(Array.from(result)).toEqual([2, 2]) // Both map to darkest color (black)
  })

  it('preserves exact matches when fallback is enabled', () => {
    const palette = [
      [255, 255, 255], // White
      [128, 128, 128], // Gray
      [0, 0, 0] // Black - darkest
    ] as [number, number, number][]

    const rgba = new Uint8ClampedArray([
      255,
      255,
      255,
      255, // White - exact match (index 0)
      255,
      0,
      0,
      255, // Red - missing, should map to black (index 2)
      128,
      128,
      128,
      255 // Gray - exact match (index 1)
    ])

    const result = rgbToIndexBufferExact(rgba, palette, true, true)
    expect(Array.from(result)).toEqual([0, 2, 1])
  })
})
