import { encodeByte } from './encode-byte'

it('Mode 0: pixels 13 (1101) + 6 (0110) → 0x9E', () => {
  const indexBuf = new Uint8Array([13, 6])
  const result = encodeByte(indexBuf, 0, 0, 0, 2)
  expect(result).toBe(0x9e)
})
