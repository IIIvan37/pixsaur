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
      const left = indexBuf[px] & 0x0f
      const right = indexBuf[px + 1] & 0x0f

      // Mode 0 with Img2CPC correction: swap bits 1 and 2
      byte =
        ((left & 1) << 7) |
        ((right & 1) << 6) |
        (((left >> 2) & 1) << 5) | // bit 2 → position 5 (au lieu de bit 1)
        (((right >> 2) & 1) << 4) | // bit 2 → position 4 (au lieu de bit 1)
        (((left >> 1) & 1) << 3) | // bit 1 → position 3 (au lieu de bit 2)
        (((right >> 1) & 1) << 2) | // bit 1 → position 2 (au lieu de bit 2)
        (((left >> 3) & 1) << 1) |
        ((right >> 3) & 1)
      break
    }

    case 1: {
      const c0 = indexBuf[px + 0] & 0x03
      const c1 = indexBuf[px + 1] & 0x03
      const c2 = indexBuf[px + 2] & 0x03
      const c3 = indexBuf[px + 3] & 0x03
      // Mode 1 format from CPC docs: bit 7=p0b0, 6=p1b0, 5=p2b0, 4=p3b0, 3=p0b1, 2=p1b1, 1=p2b1, 0=p3b1
      byte =
        ((c0 & 1) << 7) | // pixel 0 bit 0 → position 7
        ((c1 & 1) << 6) | // pixel 1 bit 0 → position 6
        ((c2 & 1) << 5) | // pixel 2 bit 0 → position 5
        ((c3 & 1) << 4) | // pixel 3 bit 0 → position 4
        (((c0 >> 1) & 1) << 3) | // pixel 0 bit 1 → position 3
        (((c1 >> 1) & 1) << 2) | // pixel 1 bit 1 → position 2
        (((c2 >> 1) & 1) << 1) | // pixel 2 bit 1 → position 1
        ((c3 >> 1) & 1) // pixel 3 bit 1 → position 0

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
