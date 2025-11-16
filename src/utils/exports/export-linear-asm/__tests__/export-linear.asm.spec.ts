import { describe, expect, it } from 'vitest'
import { exportLinearAsm, splitLinearIntoChunks } from '../export-linear.asm'

describe('exportLinearAsm', () => {
  it('encodes a small linear image correctly for mode 1', () => {
    // Mode 1 has 4 pixels per byte
    const width = 8
    const height = 2
    const indexBuf = new Uint8Array(width * height)
    // Fill with some pattern
    for (let i = 0; i < indexBuf.length; i++) indexBuf[i] = i % 4

    const modeConfig = {
      mode: 1 as 1,
      width,
      height,
      overscan: true,
      nColors: 4,
      scaleX: 1,
      scaleY: 1
    }
    const data = exportLinearAsm(indexBuf, modeConfig)

    // Expect data length = height * floor(width / pixelsPerByte)
    // pixelsPerByte for mode 1 = 4
    expect(data.length).toBe(height * Math.floor(width / 4))
    // Check sample bytes are produced (not all zero)
    expect(Array.from(data)).not.toEqual(new Array(data.length).fill(0))
  })
})

describe('splitLinearIntoChunks', () => {
  it('returns single-chunk for data <= limit', () => {
    const small = new Uint8Array(8 * 1024)
    const chunks = splitLinearIntoChunks(small)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].index).toBe(1)
  })

  it('splits into multiple chunks for large data', () => {
    const large = new Uint8Array(16 * 1024 * 2 + 10)
    const chunks = splitLinearIntoChunks(large)
    // should be at least 2
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // indices must start from 1 and be incremental
    expect(chunks[0].index).toBe(1)
    expect(chunks[1].index).toBe(2)
    // verify chunk sizes are within the max limit
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].data.length).toBeLessThanOrEqual(16 * 1024)
    }
  })
})
