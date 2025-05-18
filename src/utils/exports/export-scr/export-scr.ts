import { encodeByte } from '../encode-byte'

function computeCPCAddress(x: number, y: number): number {
  const row = y & 0b00000111 // y % 8
  const block = (y >> 3) * 80 // ligne logique
  return row * 2048 + block + x // position dans la mémoire écran
}
export function exportSCR(
  indexBuf: Uint8Array,
  mode: 0 | 1 | 2,
  width: number
): Uint8Array {
  const scr = new Uint8Array(0x4000).fill(0)
  const pixelsPerByte = [2, 4, 8][mode]
  const height = 200
  console.assert(
    width === [160, 320, 640][mode],
    `❌ Width incorrect: got ${width}, expected ${[160, 320, 640][mode]}`
  )

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < 80; x++) {
      const px = x * pixelsPerByte
      const byte = encodeByte(indexBuf, px, y, mode, width)
      const addr = computeCPCAddress(x, y)
      scr[addr] = byte
    }
  }

  return scr
}
