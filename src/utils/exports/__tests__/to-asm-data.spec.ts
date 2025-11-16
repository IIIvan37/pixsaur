import { describe, expect, it } from 'vitest'
import { toASMData } from '../to-asm-data'

describe('toASMData', () => {
  it('returns single assembly string for data <= 16KB', () => {
    const size = 16 * 1024 // exactly 16KB
    const buf = new Uint8Array(size)
    // set some different bytes so the asm contains real values
    buf[0] = 0
    buf[1] = 1
    buf[15] = 0xff

    const result = toASMData(buf, 'test_label')
    expect(typeof result).toBe('string')
    if (typeof result === 'string') {
      // Should include the label
      expect(result).toContain('test_label:')
      // Should include at least one db directive
      expect(result).toMatch(/db\s+#00,\s+#01/)
      // The last line of the first 16-bytes should contain the 0xFF value
      expect(result).toMatch(/#FF/)
    }
  })

  it('returns chunked assembly files for data > 16KB', () => {
    const size = 16 * 1024 * 2 + 128 // 2 chunks + some leftover
    const buf = new Uint8Array(size)
    // populate with non-zero values at different offsets
    buf[0] = 0x01
    buf[16 * 1024] = 0x02

    const result = toASMData(buf, 'bigdata')
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      // should return at least 3 chunk files
      expect(result.length).toBeGreaterThanOrEqual(2)
      // check metadata shape
      for (const chunk of result) {
        expect(chunk.filename.endsWith('.asm')).toBe(true)
        expect(chunk.content).toContain('; Chunk')
        expect(chunk.content).toContain('db ')
      }
      // first chunk label should include base label
      expect(result[0].content).toContain('bigdata_chunk_0:')
    }
  })
})
