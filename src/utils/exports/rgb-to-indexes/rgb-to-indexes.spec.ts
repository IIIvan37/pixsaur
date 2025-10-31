import {
  remapImageDataToPalette,
  rgbToIndexBufferExact
} from './rgb-to-indexes'

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

  it('quantizes colors to CPC levels when quantize is true', () => {
    const palette = [
      [0, 0, 0], // Black
      [128, 128, 128], // Gray
      [255, 255, 255] // White
    ] as [number, number, number][]

    // Colors that need quantization: [100, 100, 100] -> [128, 128, 128] (gray)
    const rgba = new Uint8ClampedArray([
      100,
      100,
      100,
      255, // Should quantize to gray (index 1)
      200,
      200,
      200,
      255 // Should quantize to white (index 2)
    ])

    const result = rgbToIndexBufferExact(rgba, palette, true)
    expect(Array.from(result)).toEqual([1, 2])
  })

  it('does not quantize colors when quantize is false', () => {
    const palette = [
      [100, 100, 100], // Exact match for first pixel
      [200, 200, 200] // Exact match for second pixel
    ] as [number, number, number][]

    const rgba = new Uint8ClampedArray([
      100,
      100,
      100,
      255, // Exact match
      200,
      200,
      200,
      255 // Exact match
    ])

    const result = rgbToIndexBufferExact(rgba, palette, false)
    expect(Array.from(result)).toEqual([0, 1])
  })

  it('handles single pixel buffers', () => {
    const palette = [[255, 0, 0]] as [number, number, number][]
    const rgba = new Uint8ClampedArray([255, 0, 0, 255])
    const result = rgbToIndexBufferExact(rgba, palette)
    expect(Array.from(result)).toEqual([0])
  })

  it('handles large buffers efficiently', () => {
    const palette = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ] as [number, number, number][]

    // Create a larger buffer with alternating colors
    const size = 1000
    const rgba = new Uint8ClampedArray(size * 4)
    for (let i = 0; i < size; i++) {
      const colorIndex = i % 3
      rgba[i * 4] = colorIndex === 0 ? 255 : 0 // R
      rgba[i * 4 + 1] = colorIndex === 1 ? 255 : 0 // G
      rgba[i * 4 + 2] = colorIndex === 2 ? 255 : 0 // B
      rgba[i * 4 + 3] = 255 // A
    }

    const result = rgbToIndexBufferExact(rgba, palette)
    expect(result.length).toBe(size)
    // Check first few values
    expect(Array.from(result.slice(0, 6))).toEqual([0, 1, 2, 0, 1, 2])
  })
})

describe('remapImageDataToPalette', () => {
  it('remaps ImageData pixels to closest palette colors', () => {
    const palette = [
      [0, 0, 0], // Black
      [255, 255, 255] // White
    ] as [number, number, number][]

    // Create test ImageData: gray pixels should map to closest (black or white)
    const width = 2
    const height = 2
    const data = new Uint8ClampedArray([
      128,
      128,
      128,
      255, // Gray -> should map to white (closer to 255)
      64,
      64,
      64,
      255, // Dark gray -> should map to black (closer to 0)
      192,
      192,
      192,
      255, // Light gray -> should map to white
      0,
      0,
      0,
      255 // Black -> exact match
    ])
    const imgData = new ImageData(data, width, height)

    const result = remapImageDataToPalette(imgData, palette)

    expect(result.width).toBe(width)
    expect(result.height).toBe(height)
    expect(result.data.length).toBe(data.length)

    // Check that pixels are now in the palette
    const resultData = Array.from(result.data)
    expect(resultData.slice(0, 3)).toEqual([255, 255, 255]) // First pixel mapped to white
    expect(resultData.slice(4, 7)).toEqual([0, 0, 0]) // Second pixel mapped to black
    expect(resultData.slice(8, 11)).toEqual([255, 255, 255]) // Third pixel mapped to white
    expect(resultData.slice(12, 15)).toEqual([0, 0, 0]) // Fourth pixel stays black
  })

  it('preserves alpha channel', () => {
    const palette = [[255, 0, 0]] as [number, number, number][]

    const data = new Uint8ClampedArray([100, 50, 25, 128]) // Semi-transparent
    const imgData = new ImageData(data, 1, 1)

    const result = remapImageDataToPalette(imgData, palette)

    expect(result.data[3]).toBe(128) // Alpha should be preserved
  })

  it('uses color caching for performance', () => {
    const palette = [
      [0, 0, 0], // Black
      [255, 255, 255] // White
    ] as [number, number, number][]

    // Create ImageData with repeated colors that are closer to black
    const data = new Uint8ClampedArray([
      50,
      50,
      50,
      255, // Same dark color repeated - closer to black
      50,
      50,
      50,
      255,
      50,
      50,
      50,
      255
    ])
    const imgData = new ImageData(data, 3, 1)

    const result = remapImageDataToPalette(imgData, palette)

    // All pixels should map to black (closer than white)
    expect(Array.from(result.data.slice(0, 3))).toEqual([0, 0, 0])
    expect(Array.from(result.data.slice(4, 7))).toEqual([0, 0, 0])
    expect(Array.from(result.data.slice(8, 11))).toEqual([0, 0, 0])
  })

  it('handles empty ImageData', () => {
    const palette = [[0, 0, 0]] as [number, number, number][]
    const imgData = new ImageData(new Uint8ClampedArray(0), 0, 0)

    const result = remapImageDataToPalette(imgData, palette)

    expect(result.width).toBe(0)
    expect(result.height).toBe(0)
    expect(result.data.length).toBe(0)
  })

  it('handles single pixel ImageData', () => {
    const palette = [[255, 0, 0]] as [number, number, number][]
    const data = new Uint8ClampedArray([200, 50, 50, 255]) // Orange-ish color
    const imgData = new ImageData(data, 1, 1)

    const result = remapImageDataToPalette(imgData, palette)

    // Should map to the closest palette color (red)
    expect(Array.from(result.data.slice(0, 3))).toEqual([255, 0, 0])
    expect(result.data[3]).toBe(255) // Alpha preserved
  })

  it('finds closest color using Euclidean distance', () => {
    const palette = [
      [255, 0, 0], // Red
      [0, 255, 0], // Green
      [0, 0, 255] // Blue
    ] as [number, number, number][]

    // Lime green color (50, 200, 50) - clearly closest to green (0, 255, 0)
    const data = new Uint8ClampedArray([50, 200, 50, 255])
    const imgData = new ImageData(data, 1, 1)

    const result = remapImageDataToPalette(imgData, palette)

    // Should map to green (clearly closest in 3D RGB space)
    expect(Array.from(result.data.slice(0, 3))).toEqual([0, 255, 0])
  })
})
