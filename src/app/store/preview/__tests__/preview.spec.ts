import { describe, expect, it } from 'vitest'
import { quantizeCPC } from '@/export'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { applyManualEditsToBuffer, type IndexBufferData } from '../preview'

describe('applyManualEditsToBuffer', () => {
  const createBuffer = (
    data: number[],
    width: number,
    height: number
  ): IndexBufferData => ({
    buffer: new Uint8Array(data),
    width,
    height,
    palette: [
      [0, 0, 0],
      [255, 255, 255]
    ] as Vector[]
  })

  it('should return original buffer when no edits', () => {
    const buffer = createBuffer([0, 0, 0, 0], 2, 2)
    const edits = new Map<string, number>()

    const result = applyManualEditsToBuffer(buffer, edits)

    expect(result).toBe(buffer) // Same reference
  })

  it('should apply single edit', () => {
    const buffer = createBuffer([0, 0, 0, 0], 2, 2)
    const edits = new Map<string, number>([['1,0', 5]])

    const result = applyManualEditsToBuffer(buffer, edits)

    expect(result.buffer[1]).toBe(5)
    expect(result.buffer[0]).toBe(0) // Unchanged
    expect(result).not.toBe(buffer) // New reference
  })

  it('should apply multiple edits', () => {
    const buffer = createBuffer([0, 0, 0, 0], 2, 2)
    const edits = new Map<string, number>([
      ['0,0', 1],
      ['1,1', 2]
    ])

    const result = applyManualEditsToBuffer(buffer, edits)

    expect(result.buffer[0]).toBe(1)
    expect(result.buffer[3]).toBe(2) // y=1, x=1 -> offset 3
  })

  it('should ignore out-of-bounds edits', () => {
    const buffer = createBuffer([0, 0, 0, 0], 2, 2)
    const edits = new Map<string, number>([
      ['10,10', 5], // Out of bounds
      ['0,0', 1] // Valid
    ])

    const result = applyManualEditsToBuffer(buffer, edits)

    expect(result.buffer[0]).toBe(1)
    expect(result.buffer.length).toBe(4)
  })

  it('should preserve metadata', () => {
    const buffer: IndexBufferData = {
      buffer: new Uint8Array([0, 0]),
      width: 2,
      height: 1,
      palette: [
        [255, 0, 0],
        [0, 255, 0]
      ] as Vector[]
    }
    const edits = new Map<string, number>([['0,0', 1]])

    const result = applyManualEditsToBuffer(buffer, edits)

    expect(result.width).toBe(2)
    expect(result.height).toBe(1)
    expect(result.palette).toEqual(buffer.palette)
  })

  it('should not modify original buffer', () => {
    const buffer = createBuffer([0, 0, 0, 0], 2, 2)
    const edits = new Map<string, number>([['0,0', 5]])

    applyManualEditsToBuffer(buffer, edits)

    expect(buffer.buffer[0]).toBe(0) // Original unchanged
  })
})

// Test de la fonction de quantification CPC isolément
describe('CPC Quantization Logic', () => {
  it('should quantize values correctly', () => {
    // Test exact matches
    expect(quantizeCPC(0)).toBe(0)
    expect(quantizeCPC(128)).toBe(128)
    expect(quantizeCPC(255)).toBe(255)

    // Test rounding
    expect(quantizeCPC(63)).toBe(0) // Closer to 0 (63 vs 65)
    expect(quantizeCPC(64)).toBe(0) // Equal distance, function returns first (0)
    expect(quantizeCPC(65)).toBe(128) // Closer to 128 (63 vs 65)
    expect(quantizeCPC(191)).toBe(128) // Closer to 128 (63 vs 64)
    expect(quantizeCPC(192)).toBe(255) // Closer to 255 (64 vs 63)

    // Test the problematic value from the error
    expect(quantizeCPC(125)).toBe(128) // Should round to 128
    expect(quantizeCPC(3)).toBe(0) // Should round to 0
    expect(quantizeCPC(41)).toBe(0) // Should round to 0
  })

  it('should handle edge cases', () => {
    expect(quantizeCPC(-1)).toBe(0) // Negative values
    expect(quantizeCPC(300)).toBe(255) // Values above 255
  })
})
