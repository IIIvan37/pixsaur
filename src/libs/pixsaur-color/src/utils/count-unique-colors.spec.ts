import {
  countUniqueColors,
  extractUniqueColors,
  isLowColorImage
} from './count-unique-colors'

describe('count-unique-colors', () => {
  /**
   * Helper to create an RGBA buffer from color arrays
   */
  function createRGBABuffer(
    colors: Array<[number, number, number]>
  ): Uint8ClampedArray {
    const buffer = new Uint8ClampedArray(colors.length * 4)
    for (let i = 0; i < colors.length; i++) {
      buffer[i * 4] = colors[i][0]
      buffer[i * 4 + 1] = colors[i][1]
      buffer[i * 4 + 2] = colors[i][2]
      buffer[i * 4 + 3] = 255 // Alpha
    }
    return buffer
  }

  describe('countUniqueColors', () => {
    it('should count a single color', () => {
      const buffer = createRGBABuffer([
        [255, 0, 0],
        [255, 0, 0],
        [255, 0, 0]
      ])
      expect(countUniqueColors(buffer)).toBe(1)
    })

    it('should count multiple distinct colors', () => {
      const buffer = createRGBABuffer([
        [255, 0, 0], // Red
        [0, 255, 0], // Green
        [0, 0, 255], // Blue
        [255, 255, 0] // Yellow
      ])
      expect(countUniqueColors(buffer)).toBe(4)
    })

    it('should count colors with duplicates correctly', () => {
      const buffer = createRGBABuffer([
        [255, 0, 0],
        [0, 255, 0],
        [255, 0, 0], // Duplicate
        [0, 255, 0], // Duplicate
        [0, 0, 255]
      ])
      expect(countUniqueColors(buffer)).toBe(3)
    })

    it('should early exit when maxToCount is exceeded', () => {
      const buffer = createRGBABuffer([
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0],
        [255, 0, 255]
      ])
      // With maxToCount=3, should stop counting at 4 (3+1)
      expect(countUniqueColors(buffer, 3)).toBe(4)
    })

    it('should handle empty buffer', () => {
      const buffer = new Uint8ClampedArray(0)
      expect(countUniqueColors(buffer)).toBe(0)
    })

    it('should count 16 colors typical of C64 image', () => {
      // Simulate C64 palette colors
      const c64Colors: Array<[number, number, number]> = [
        [0, 0, 0], // Black
        [255, 255, 255], // White
        [136, 0, 0], // Red
        [170, 255, 238], // Cyan
        [204, 68, 204], // Purple
        [0, 204, 85], // Green
        [0, 0, 170], // Blue
        [238, 238, 119], // Yellow
        [221, 136, 85], // Orange
        [102, 68, 0], // Brown
        [255, 119, 119], // Light Red
        [51, 51, 51], // Dark Grey
        [119, 119, 119], // Grey
        [170, 255, 102], // Light Green
        [0, 136, 255], // Light Blue
        [187, 187, 187] // Light Grey
      ]

      // Create buffer with some duplicates
      const colors = [...c64Colors, ...c64Colors, ...c64Colors]
      const buffer = createRGBABuffer(colors)
      expect(countUniqueColors(buffer)).toBe(16)
    })
  })

  describe('extractUniqueColors', () => {
    it('should extract unique colors as RGB arrays', () => {
      const buffer = createRGBABuffer([
        [255, 0, 0],
        [0, 255, 0],
        [255, 0, 0] // Duplicate
      ])

      const colors = extractUniqueColors(buffer)
      expect(colors).toHaveLength(2)
      expect(colors).toContainEqual([255, 0, 0])
      expect(colors).toContainEqual([0, 255, 0])
    })

    it('should respect maxColors limit', () => {
      const buffer = createRGBABuffer([
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0]
      ])

      const colors = extractUniqueColors(buffer, 2)
      expect(colors).toHaveLength(2)
    })
  })

  describe('isLowColorImage', () => {
    it('should return true for image with 16 or fewer colors', () => {
      const buffer = createRGBABuffer([
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ])
      expect(isLowColorImage(buffer)).toBe(true)
    })

    it('should return false for image with more than 16 colors', () => {
      // Create 20 distinct colors
      const colors: Array<[number, number, number]> = []
      for (let i = 0; i < 20; i++) {
        colors.push([i * 10, (i * 10) % 256, (i * 10) % 128])
      }
      const buffer = createRGBABuffer(colors)
      expect(isLowColorImage(buffer)).toBe(false)
    })

    it('should use custom threshold', () => {
      const buffer = createRGBABuffer([
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0],
        [255, 0, 255]
      ])

      expect(isLowColorImage(buffer, 4)).toBe(false)
      expect(isLowColorImage(buffer, 5)).toBe(true)
    })
  })
})
