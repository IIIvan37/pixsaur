// encode-byte.ts

export function encodeByte(
  indexBuf: Uint8Array,
  x: number,
  y: number,
  mode: 0 | 1 | 2,
  width: number
): number {
  const px = y * width + x
  let byte = 0

  switch (mode) {
    case 0: {
      const left = indexBuf[px] & 0x0f // pixel gauche
      const right = indexBuf[px + 1] & 0x0f // pixel droit

      byte =
        (((left >> 0) & 1) << 7) |
        (((right >> 0) & 1) << 6) |
        (((left >> 1) & 1) << 5) |
        (((right >> 1) & 1) << 4) |
        (((left >> 2) & 1) << 3) |
        (((right >> 2) & 1) << 2) |
        (((left >> 3) & 1) << 1) |
        (((right >> 3) & 1) << 0)
      break
    }

    case 1: {
      const c0 = indexBuf[px + 0] & 0x03
      const c1 = indexBuf[px + 1] & 0x03
      const c2 = indexBuf[px + 2] & 0x03
      const c3 = indexBuf[px + 3] & 0x03

      byte =
        ((c0 & 0x01) << 7) |
        ((c0 & 0x02) << 2) |
        ((c1 & 0x01) << 6) |
        ((c1 & 0x02) << 0) |
        ((c2 & 0x01) << 5) |
        ((c2 & 0x02) >> 1) |
        ((c3 & 0x01) << 4) |
        ((c3 & 0x02) >> 3)
      break
    }

    case 2: {
      for (let i = 0; i < 8; i++) {
        const c = indexBuf[px + i] & 0x01
        byte |= c << (7 - i)
      }
      break
    }
  }

  return byte
}
