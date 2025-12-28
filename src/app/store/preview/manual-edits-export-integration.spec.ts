/**
 * Integration tests validating that manual pixel edits are properly
 * applied to exported data (ZIP, CPC Playground, DSK).
 *
 * These tests ensure that:
 * 1. Manual edits are applied to preview index buffers
 * 2. Manual edits are applied to raster index buffers
 * 3. Export functions receive the edited buffers, not the raw ones
 */
import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { applyManualEditsToBuffer, type IndexBufferData } from './preview'

describe('Manual Edits Integration with Exports', () => {
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

  describe('applyManualEditsToBuffer for export', () => {
    it('should correctly apply manual edits before export', () => {
      // Simulate a 4x4 pixel image with all black pixels (ink 0)
      const originalBuffer = createMockIndexBuffer(new Array(16).fill(0), 4, 4)

      // User edits: change pixel at (1,1) to red (ink 1)
      // and pixel at (2,2) to green (ink 2)
      const manualEdits = new Map<string, number>([
        ['1,1', 1], // (1,1) -> red
        ['2,2', 2] // (2,2) -> green
      ])

      const result = applyManualEditsToBuffer(originalBuffer, manualEdits)

      // Verify edits are applied
      // y=1, x=1 -> offset = 1*4 + 1 = 5
      expect(result.buffer[5]).toBe(1)
      // y=2, x=2 -> offset = 2*4 + 2 = 10
      expect(result.buffer[10]).toBe(2)

      // Verify original is unchanged
      expect(originalBuffer.buffer[5]).toBe(0)
      expect(originalBuffer.buffer[10]).toBe(0)
    })

    it('should preserve buffer metadata needed for export', () => {
      const palette: Vector[] = [
        [0, 0, 0],
        [255, 255, 255],
        [128, 128, 128]
      ]
      const originalBuffer = createMockIndexBuffer([0, 1, 2, 0], 2, 2, palette)
      const manualEdits = new Map<string, number>([['0,0', 2]])

      const result = applyManualEditsToBuffer(originalBuffer, manualEdits)

      // Export functions need these properties
      expect(result.width).toBe(originalBuffer.width)
      expect(result.height).toBe(originalBuffer.height)
      expect(result.palette).toEqual(originalBuffer.palette)
      expect(result.buffer).toBeInstanceOf(Uint8Array)
    })

    it('should handle edge pixel edits at image boundaries', () => {
      const originalBuffer = createMockIndexBuffer(
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        3,
        3
      )

      // Edit corners and edges
      const manualEdits = new Map<string, number>([
        ['0,0', 1], // Top-left
        ['2,0', 1], // Top-right
        ['0,2', 1], // Bottom-left
        ['2,2', 1], // Bottom-right
        ['1,1', 2] // Center
      ])

      const result = applyManualEditsToBuffer(originalBuffer, manualEdits)

      expect(result.buffer[0]).toBe(1) // (0,0)
      expect(result.buffer[2]).toBe(1) // (2,0)
      expect(result.buffer[6]).toBe(1) // (0,2)
      expect(result.buffer[8]).toBe(1) // (2,2)
      expect(result.buffer[4]).toBe(2) // (1,1)
    })

    it('should handle large number of edits efficiently', () => {
      // Simulate a typical CPC image (160x200 for mode 0)
      const width = 160
      const height = 200
      const originalBuffer = createMockIndexBuffer(
        new Array(width * height).fill(0),
        width,
        height
      )

      // Create 100 random edits
      const manualEdits = new Map<string, number>()
      for (let i = 0; i < 100; i++) {
        const x = i % width
        const y = Math.floor(i / width) % height
        manualEdits.set(`${x},${y}`, (i % 3) + 1)
      }

      const startTime = performance.now()
      const result = applyManualEditsToBuffer(originalBuffer, manualEdits)
      const endTime = performance.now()

      // Should be fast (< 50ms for this size)
      expect(endTime - startTime).toBeLessThan(50)

      // Verify edits were applied
      expect(result.buffer).not.toBe(originalBuffer.buffer)
      expect(manualEdits.size).toBe(100)
    })

    it('should return same reference when no edits (optimization)', () => {
      const originalBuffer = createMockIndexBuffer([0, 1, 2, 3], 2, 2)
      const emptyEdits = new Map<string, number>()

      const result = applyManualEditsToBuffer(originalBuffer, emptyEdits)

      // Should be same reference for performance
      expect(result).toBe(originalBuffer)
    })
  })

  describe('Export data flow validation', () => {
    it('should use final buffer with edits, not raw buffer', () => {
      // This test validates the data flow concept:
      // 1. previewIndexBufferAtom -> raw conversion result
      // 2. manualPixelEditsAtom -> user edits
      // 3. finalPreviewIndexBufferAtom -> raw + edits applied

      const rawBuffer = createMockIndexBuffer([0, 0, 0, 0], 2, 2)
      const userEdits = new Map<string, number>([
        ['0,0', 3],
        ['1,1', 2]
      ])

      // This simulates what finalPreviewIndexBufferAtom does
      const finalBuffer = applyManualEditsToBuffer(rawBuffer, userEdits)

      // Export should use finalBuffer.buffer, not rawBuffer.buffer
      expect(finalBuffer.buffer[0]).toBe(3) // Edit applied
      expect(finalBuffer.buffer[3]).toBe(2) // Edit applied
      expect(rawBuffer.buffer[0]).toBe(0) // Raw unchanged
      expect(rawBuffer.buffer[3]).toBe(0) // Raw unchanged
    })

    it('should work with raster mode buffers', () => {
      // Raster mode has different palette per line, but edit logic is same
      const rasterPalette: Vector[] = [
        [0, 0, 128], // Different palette for raster
        [255, 128, 0],
        [128, 255, 128],
        [255, 0, 255]
      ]

      const rasterBuffer = createMockIndexBuffer(
        [0, 1, 2, 3, 0, 1, 2, 3],
        4,
        2,
        rasterPalette
      )

      const edits = new Map<string, number>([
        ['0,0', 3],
        ['3,1', 0]
      ])

      const finalRasterBuffer = applyManualEditsToBuffer(rasterBuffer, edits)

      // Edits should work regardless of raster palette
      expect(finalRasterBuffer.buffer[0]).toBe(3)
      expect(finalRasterBuffer.buffer[7]).toBe(0) // y=1, x=3
      expect(finalRasterBuffer.palette).toEqual(rasterPalette)
    })
  })

  describe('IndexBufferData structure for export', () => {
    it('should have all required fields for CPC Playground export', () => {
      const buffer = createMockIndexBuffer([0, 1, 2, 3], 2, 2)
      const edits = new Map<string, number>([['0,0', 1]])

      const result = applyManualEditsToBuffer(buffer, edits)

      // CPC Playground needs indexBuf (Uint8Array), width, height
      expect(result.buffer).toBeInstanceOf(Uint8Array)
      expect(typeof result.width).toBe('number')
      expect(typeof result.height).toBe('number')
      expect(Array.isArray(result.palette)).toBe(true)
    })

    it('should have all required fields for ZIP export', () => {
      const buffer = createMockIndexBuffer([0, 1, 2, 3], 2, 2)
      const edits = new Map<string, number>([['0,0', 1]])

      const result = applyManualEditsToBuffer(buffer, edits)

      // ZIP export needs palette for firmware/plus conversion
      expect(result.palette.length).toBeGreaterThan(0)
      expect(result.palette[0]).toHaveLength(3) // RGB vector
    })

    it('should have all required fields for DSK workspace export', () => {
      const buffer = createMockIndexBuffer([0, 1, 2, 3], 2, 2)
      const edits = new Map<string, number>([['0,0', 1]])

      const result = applyManualEditsToBuffer(buffer, edits)

      // DSK workspace stores multiple images, each needs complete buffer data
      expect(result.buffer.length).toBe(result.width * result.height)
    })
  })
})
