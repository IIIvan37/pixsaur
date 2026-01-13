import { createStore } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resizeModeAtom } from '../../config/config'
import { quantizationSourceImageAtom } from './quantization'

// Mock the image atoms
vi.mock('./image-pipeline', () => ({
  croppedImageAtom: {
    // Atom that returns a mock cropped image
    read: () =>
      Promise.resolve(
        new ImageData(new Uint8ClampedArray(40), 2, 5) // Small 2x5 image (no padding)
      )
  },
  smoothedImageAtom: {
    // Atom that returns a mock smoothed image (with potential padding)
    read: () =>
      Promise.resolve(
        new ImageData(new Uint8ClampedArray(128000), 160, 200) // Full CPC size
      )
  }
}))

describe('quantizationSourceImageAtom', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    vi.clearAllMocks()
  })

  describe('resize mode selection', () => {
    it('should use croppedImageAtom in origin mode to avoid black padding', async () => {
      // This is a regression test for the CPC Plus palette bug
      // In origin mode, the palette was dominated by black padding pixels
      // Now it should use the cropped image before padding is applied
      store.set(resizeModeAtom, 'origin')

      const sourceImage = await store.get(quantizationSourceImageAtom)

      // In origin mode, we expect the smaller cropped image (2x5)
      // not the full 160x200 image with padding
      expect(sourceImage).toBeDefined()
      if (sourceImage) {
        // The source should be the cropped image dimensions
        expect(sourceImage.width).toBe(2)
        expect(sourceImage.height).toBe(5)
      }
    })

    it('should use smoothedImageAtom in auto mode', async () => {
      store.set(resizeModeAtom, 'auto')

      const sourceImage = await store.get(quantizationSourceImageAtom)

      // In auto mode, we expect the full smoothed image (160x200)
      expect(sourceImage).toBeDefined()
      if (sourceImage) {
        expect(sourceImage.width).toBe(160)
        expect(sourceImage.height).toBe(200)
      }
    })
  })

  describe('regression test: CPC Plus palette in origin mode', () => {
    it('should not use padded image for palette quantization in origin mode', async () => {
      // Bug description: In CPC Plus + origin mode, the black padding
      // pixels dominated the palette, causing "Not enough candidates"
      // error in the quantizer (only 1 candidate instead of 16)

      store.set(resizeModeAtom, 'origin')
      const sourceImage = await store.get(quantizationSourceImageAtom)

      // The image should be the cropped version (small, no padding)
      // not the full CPC dimensions with black padding
      expect(sourceImage).toBeDefined()
      if (sourceImage) {
        // Should NOT be full CPC dimensions (160x200)
        const isFullCPCSize =
          sourceImage.width === 160 && sourceImage.height === 200
        expect(isFullCPCSize).toBe(false)
      }
    })
  })
})
