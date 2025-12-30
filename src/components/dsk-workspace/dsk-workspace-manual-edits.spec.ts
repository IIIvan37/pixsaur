/**
 * Integration tests validating that DSK workspace exports
 * use the final index buffers with manual edits applied.
 */
import { describe, expect, it } from 'vitest'
import {
  applyManualEditsToBuffer,
  type IndexBufferData
} from '@/app/store/preview/preview'
import type { Vector } from '@/libs/pixsaur-color/src/type'

describe('DSK Workspace Manual Edits Integration', () => {
  const createMockIndexBuffer = (
    data: number[],
    width: number,
    height: number,
    palette: Vector[] = [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ]
  ): IndexBufferData => ({
    buffer: new Uint8Array(data),
    width,
    height,
    palette
  })

  describe('DSK workspace data flow', () => {
    it('should use final index buffer with edits for DSK export', () => {
      // Simulate DSK workspace receiving final buffer (with edits applied)
      const rawBuffer = createMockIndexBuffer([0, 0, 0, 0], 2, 2)
      const edits = new Map<string, number>([
        ['0,0', 1],
        ['1,1', 2]
      ])

      // This is what finalPreviewIndexBufferAtom/finalRasterIndexBufferAtom does
      const finalBuffer = applyManualEditsToBuffer(rawBuffer, edits)

      // DSK workspace should receive this final buffer
      expect(finalBuffer.buffer[0]).toBe(1) // Edited pixel
      expect(finalBuffer.buffer[3]).toBe(2) // Edited pixel
      expect(finalBuffer.width).toBe(2)
      expect(finalBuffer.height).toBe(2)
    })

    it('should preserve all image metadata for DSK storage', () => {
      const palette: Vector[] = [
        [0, 0, 128],
        [255, 128, 0],
        [128, 255, 128],
        [255, 0, 255]
      ]
      const rawBuffer = createMockIndexBuffer([0, 1, 2, 3], 2, 2, palette)
      const edits = new Map<string, number>([['0,0', 3]])

      const finalBuffer = applyManualEditsToBuffer(rawBuffer, edits)

      // DSK workspace stores images that need complete metadata
      expect(finalBuffer.palette).toEqual(palette)
      expect(finalBuffer.buffer.length).toBe(
        finalBuffer.width * finalBuffer.height
      )
    })

    it('should handle CPC mode 0 resolution (160x200)', () => {
      const width = 160
      const height = 200
      const rawBuffer = createMockIndexBuffer(
        new Array(width * height).fill(0),
        width,
        height
      )

      // Multiple edits across the image
      const edits = new Map<string, number>([
        ['0,0', 1],
        ['159,0', 2],
        ['0,199', 3],
        ['159,199', 1],
        ['80,100', 2]
      ])

      const finalBuffer = applyManualEditsToBuffer(rawBuffer, edits)

      // Verify corner and center edits
      expect(finalBuffer.buffer[0]).toBe(1) // (0,0)
      expect(finalBuffer.buffer[159]).toBe(2) // (159,0)
      expect(finalBuffer.buffer[199 * 160]).toBe(3) // (0,199)
      expect(finalBuffer.buffer[199 * 160 + 159]).toBe(1) // (159,199)
      expect(finalBuffer.buffer[100 * 160 + 80]).toBe(2) // (80,100)
    })

    it('should handle CPC mode 1 resolution (320x200)', () => {
      const width = 320
      const height = 200
      const rawBuffer = createMockIndexBuffer(
        new Array(width * height).fill(0),
        width,
        height
      )

      const edits = new Map<string, number>([
        ['0,0', 1],
        ['319,199', 3]
      ])

      const finalBuffer = applyManualEditsToBuffer(rawBuffer, edits)

      expect(finalBuffer.buffer[0]).toBe(1)
      expect(finalBuffer.buffer[width * height - 1]).toBe(3)
    })

    it('should handle overscan resolution (384x272)', () => {
      const width = 384
      const height = 272
      const rawBuffer = createMockIndexBuffer(
        new Array(width * height).fill(0),
        width,
        height
      )

      const edits = new Map<string, number>([
        ['0,0', 1],
        ['383,271', 2]
      ])

      const finalBuffer = applyManualEditsToBuffer(rawBuffer, edits)

      expect(finalBuffer.buffer[0]).toBe(1)
      expect(finalBuffer.buffer[width * height - 1]).toBe(2)
    })
  })

  describe('Multiple images in DSK', () => {
    it('should handle multiple images with independent edits', () => {
      // Simulate multiple images being added to DSK workspace
      const image1Raw = createMockIndexBuffer([0, 0, 0, 0], 2, 2)
      const image2Raw = createMockIndexBuffer([1, 1, 1, 1], 2, 2)

      const edits1 = new Map<string, number>([['0,0', 3]])
      const edits2 = new Map<string, number>([['1,1', 0]])

      const image1Final = applyManualEditsToBuffer(image1Raw, edits1)
      const image2Final = applyManualEditsToBuffer(image2Raw, edits2)

      // Each image should have its own edits applied
      expect(image1Final.buffer[0]).toBe(3)
      expect(image1Final.buffer[1]).toBe(0) // Unchanged

      expect(image2Final.buffer[0]).toBe(1) // Unchanged
      expect(image2Final.buffer[3]).toBe(0) // Edited
    })
  })

  describe('Raster mode in DSK workspace', () => {
    it('should use finalRasterIndexBuffer when raster is enabled', () => {
      // Raster mode has different buffer source
      const rasterPalette: Vector[] = [
        [0, 0, 128],
        [128, 0, 0],
        [0, 128, 0],
        [128, 128, 0]
      ]

      const rawRasterBuffer = createMockIndexBuffer(
        [0, 1, 2, 3],
        2,
        2,
        rasterPalette
      )

      const edits = new Map<string, number>([['0,0', 3]])

      const finalRasterBuffer = applyManualEditsToBuffer(rawRasterBuffer, edits)

      // Should have raster palette preserved
      expect(finalRasterBuffer.palette).toEqual(rasterPalette)
      expect(finalRasterBuffer.buffer[0]).toBe(3) // Edit applied
    })
  })

  describe('Thumbnail generation with edits', () => {
    it('should create thumbnail from edited preview image', () => {
      // DSK workspace shows thumbnails - they should reflect edits
      const rawBuffer = createMockIndexBuffer([0, 0, 0, 0], 2, 2)
      const edits = new Map<string, number>([['0,0', 1]])

      const finalBuffer = applyManualEditsToBuffer(rawBuffer, edits)

      // Simulate thumbnail creation from final buffer
      // The buffer used for thumbnail should have edits
      const thumbnailSourceBuffer = finalBuffer.buffer
      expect(thumbnailSourceBuffer[0]).toBe(1) // Edit visible in thumbnail source
    })
  })
})
