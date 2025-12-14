import { describe, expect, it } from 'vitest'
import { toASMData } from './to-asm-data'

describe('toASMData', () => {
  describe('single file export (≤ 16KB)', () => {
    it('should generate single ASM string for small data', () => {
      const data = new Uint8Array([0x00, 0x0f, 0xff, 0xab])
      const result = toASMData(data, 'test_data')

      expect(typeof result).toBe('string')
      expect(result).toContain('test_data:')
      expect(result).toContain('db #00, #0F, #00, #AB')
    })

    it('should use default label when not provided', () => {
      const data = new Uint8Array([0x42])
      const result = toASMData(data)

      expect(typeof result).toBe('string')
      expect(result).toContain('pixsaur_data:')
    })

    it('should split into lines of 16 bytes', () => {
      const data = new Uint8Array(32).fill(0x11)
      const result = toASMData(data, 'data') as string

      const lines = result.split('\n')
      // 1 label + 2 data lines
      expect(lines.length).toBe(3)
    })

    it('should handle empty data', () => {
      const data = new Uint8Array(0)
      const result = toASMData(data, 'empty')

      expect(typeof result).toBe('string')
      expect(result).toContain('empty:')
    })

    it('should format hex bytes with uppercase', () => {
      const data = new Uint8Array([0xab, 0xcd, 0xef])
      const result = toASMData(data, 'hex') as string

      expect(result).toContain('#AB')
      expect(result).toContain('#CD')
      expect(result).toContain('#EF')
    })

    it('should handle exactly 16KB data as single file', () => {
      const data = new Uint8Array(16384).fill(0x00)
      const result = toASMData(data, 'max_single')

      expect(typeof result).toBe('string')
    })
  })

  describe('chunked file export (> 16KB)', () => {
    it('should split data larger than 16KB into chunks', () => {
      const data = new Uint8Array(16385).fill(0x42) // Just over 16KB
      const result = toASMData(data, 'large_data')

      expect(Array.isArray(result)).toBe(true)
      expect(
        (result as Array<{ filename: string; content: string }>).length
      ).toBe(2)
    })

    it('should generate correct filenames for chunks', () => {
      const data = new Uint8Array(32769).fill(0x00) // ~32KB = 3 chunks
      const result = toASMData(data, 'chunked') as Array<{
        filename: string
        content: string
      }>

      expect(result[0].filename).toBe('chunked_chunk_0.asm')
      expect(result[1].filename).toBe('chunked_chunk_1.asm')
      expect(result[2].filename).toBe('chunked_chunk_2.asm')
    })

    it('should include chunk comments with offset and size', () => {
      const data = new Uint8Array(32768).fill(0x00) // Exactly 2 chunks
      const result = toASMData(data, 'with_comments') as Array<{
        filename: string
        content: string
      }>

      expect(result[0].content).toContain('; Chunk 1/2')
      expect(result[0].content).toContain('Offset: 0')
      expect(result[0].content).toContain('Size: 16384 bytes')

      expect(result[1].content).toContain('; Chunk 2/2')
      expect(result[1].content).toContain('Offset: 16384')
    })

    it('should handle last chunk with remaining bytes', () => {
      const data = new Uint8Array(16400).fill(0x00) // 16384 + 16 bytes
      const result = toASMData(data, 'partial') as Array<{
        filename: string
        content: string
      }>

      expect(result.length).toBe(2)
      expect(result[1].content).toContain('Size: 16 bytes')
    })

    it('should use labeled chunks', () => {
      const data = new Uint8Array(32768).fill(0x00)
      const result = toASMData(data, 'my_data') as Array<{
        filename: string
        content: string
      }>

      expect(result[0].content).toContain('my_data_chunk_0:')
      expect(result[1].content).toContain('my_data_chunk_1:')
    })
  })
})
