import { describe, expect, it } from 'vitest'
import { resizeForModeRAuto, resizeForModeROrigin } from './mode-r-preview'

/**
 * Helper to create an ImageData with a specific color pattern
 */
function createTestImageData(
  width: number,
  height: number,
  fillColor: [number, number, number, number] = [255, 0, 0, 255]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillColor[0]
    data[i * 4 + 1] = fillColor[1]
    data[i * 4 + 2] = fillColor[2]
    data[i * 4 + 3] = fillColor[3]
  }
  return new ImageData(data, width, height)
}

describe('Mode R Resize Functions', () => {
  describe('resizeForModeRAuto', () => {
    it('should output target dimensions (320×200)', () => {
      const src = createTestImageData(640, 400)
      const result = resizeForModeRAuto(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should handle very small source images', () => {
      const src = createTestImageData(10, 10)
      const result = resizeForModeRAuto(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should handle source larger than target', () => {
      const src = createTestImageData(1920, 1080)
      const result = resizeForModeRAuto(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should handle exact target size source', () => {
      const src = createTestImageData(320, 200)
      const result = resizeForModeRAuto(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should handle wide aspect ratio source', () => {
      const src = createTestImageData(800, 100) // 8:1 aspect ratio
      const result = resizeForModeRAuto(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should handle tall aspect ratio source', () => {
      const src = createTestImageData(100, 800) // 1:8 aspect ratio
      const result = resizeForModeRAuto(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should return valid ImageData with correct data length', () => {
      const src = createTestImageData(500, 300)
      const result = resizeForModeRAuto(src, 320, 200, true)

      expect(result.data.length).toBe(320 * 200 * 4)
    })
  })

  describe('resizeForModeROrigin', () => {
    it('should output target dimensions (320×200)', () => {
      const src = createTestImageData(640, 400)
      const result = resizeForModeROrigin(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should handle source smaller than target', () => {
      const src = createTestImageData(160, 100)
      const result = resizeForModeROrigin(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should handle source larger than target', () => {
      const src = createTestImageData(640, 400)
      const result = resizeForModeROrigin(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should handle exact target size source', () => {
      const src = createTestImageData(320, 200)
      const result = resizeForModeROrigin(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should return valid ImageData with correct data length', () => {
      const src = createTestImageData(500, 300)
      const result = resizeForModeROrigin(src, 320, 200, true)

      expect(result.data.length).toBe(320 * 200 * 4)
    })

    it('should accept center parameter false', () => {
      const src = createTestImageData(160, 100)
      const result = resizeForModeROrigin(src, 320, 200, false)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should accept center parameter true', () => {
      const src = createTestImageData(160, 100)
      const result = resizeForModeROrigin(src, 320, 200, true)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })
  })

  describe('Mode R vs Mode 1 equivalence for origin mode', () => {
    it('should use Mode 1 dimensions (320×200) not Mode 0 (160×200)', () => {
      // Mode R origin uses 320×200 with 1:1 pixel ratio (like Mode 1)
      // NOT 160×200 with 2:1 compression (like Mode 0)
      const src = createTestImageData(400, 300)
      const result = resizeForModeROrigin(src, 320, 200, true)

      // Key test: output is 320 wide, not 160
      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should produce same output dimensions for any source size', () => {
      const sizes = [
        [100, 100],
        [320, 200],
        [640, 400],
        [1920, 1080]
      ]

      for (const [w, h] of sizes) {
        const src = createTestImageData(w, h)
        const result = resizeForModeROrigin(src, 320, 200, true)

        expect(result.width).toBe(320)
        expect(result.height).toBe(200)
      }
    })
  })

  describe('resizeForModeRAuto vs resizeForModeROrigin behavior', () => {
    it('both should produce same output dimensions', () => {
      const src = createTestImageData(500, 300)

      const autoResult = resizeForModeRAuto(src, 320, 200, true)
      const originResult = resizeForModeROrigin(src, 320, 200, true)

      expect(autoResult.width).toBe(originResult.width)
      expect(autoResult.height).toBe(originResult.height)
    })

    it('auto should scale to fit, origin should crop 1:1', () => {
      // This documents the intended behavior difference:
      // - Auto: scales image to fit entirely within 320×200
      // - Origin: takes 320×200 pixels from top-left, no scaling

      const src = createTestImageData(640, 400)

      const autoResult = resizeForModeRAuto(src, 320, 200, true)
      const originResult = resizeForModeROrigin(src, 320, 200, true)

      // Both have same dimensions
      expect(autoResult.width).toBe(320)
      expect(originResult.width).toBe(320)
      expect(autoResult.height).toBe(200)
      expect(originResult.height).toBe(200)
    })
  })
})
