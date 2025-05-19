// encode-byte.spec.ts
import { encodeByte } from './encode-byte'

describe('encodeByte - Amstrad CPC modes', () => {
  // Mode 0 tests
  it('Mode 0: pixels 13 (1101) + 6 (0110) → 0x9E', () => {
    const indexBuf = new Uint8Array([13, 6])
    const result = encodeByte(indexBuf, 0, 0, 0, 2)
    expect(result).toBe(0x9e)
  })

  it('Mode 0: pixels 0 + 0 → 0x00', () => {
    const indexBuf = new Uint8Array([0, 0])
    const result = encodeByte(indexBuf, 0, 0, 0, 2)
    expect(result).toBe(0x00)
  })

  it('Mode 0: pixels 15 + 15 → 0xFF', () => {
    const indexBuf = new Uint8Array([15, 15])
    const result = encodeByte(indexBuf, 0, 0, 0, 2)
    expect(result).toBe(0xff)
  })

  // Mode 1 tests (pixels 2bpp)
  it('Mode 1: pixels [2, 1, 3, 0] → 0x6A', () => {
    const indexBuf = new Uint8Array([2, 1, 3, 0])
    const result = encodeByte(indexBuf, 0, 0, 1, 4)
    expect(result).toBe(0x6a)
  })

  it('Mode 1: pixels [0, 0, 0, 0] → 0x00', () => {
    const indexBuf = new Uint8Array([0, 0, 0, 0])
    const result = encodeByte(indexBuf, 0, 0, 1, 4)
    expect(result).toBe(0x00)
  })

  it('Mode 1: pixels [3, 3, 3, 3] → 0xFF', () => {
    const indexBuf = new Uint8Array([3, 3, 3, 3])
    const result = encodeByte(indexBuf, 0, 0, 1, 4)
    expect(result).toBe(0xff)
  })

  it('Mode 1: pixels [1, 2, 0, 3] → 0x42', () => {
    const indexBuf = new Uint8Array([1, 2, 0, 3])
    const result = encodeByte(indexBuf, 0, 0, 1, 4)
    expect(result).toBe(0x95)
  })

  // Mode 2 tests (pixels 1bpp)
  it('Mode 2: pixels [1,0,1,0,1,0,1,0] → 0xAA', () => {
    const indexBuf = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0])
    const result = encodeByte(indexBuf, 0, 0, 2, 8)
    expect(result).toBe(0xaa)
  })

  it('Mode 2: pixels [0,1,0,1,0,1,0,1] → 0x55', () => {
    const indexBuf = new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1])
    const result = encodeByte(indexBuf, 0, 0, 2, 8)
    expect(result).toBe(0x55)
  })

  it('Mode 2: pixels [0,0,0,0,0,0,0,0] → 0x00', () => {
    const indexBuf = new Uint8Array(8).fill(0)
    const result = encodeByte(indexBuf, 0, 0, 2, 8)
    expect(result).toBe(0x00)
  })

  it('Mode 2: pixels [1,1,1,1,1,1,1,1] → 0xFF', () => {
    const indexBuf = new Uint8Array(8).fill(1)
    const result = encodeByte(indexBuf, 0, 0, 2, 8)
    expect(result).toBe(0xff)
  })
})
