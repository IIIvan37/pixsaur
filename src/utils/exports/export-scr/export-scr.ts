import type { CpcModeConfig } from '@/app/store/config/types'
import { encodeByte } from '../encode-byte'

function computeCPCAddress(x: number, y: number, widthInBytes: number): number {
  const row = y & 0b00000111 // y % 8
  const block = (y >> 3) * widthInBytes // ligne logique
  return row * widthInBytes * 8 + block + x // position dans la mémoire écran
}
export function exportSCR(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig
): Uint8Array {
  const pixelsPerByte = [2, 4, 8][modeConfig.mode]
  const widthInBytes = modeConfig.width / pixelsPerByte
  const totalBytes = widthInBytes * modeConfig.height

  const scr = new Uint8Array(totalBytes).fill(0)

  for (let y = 0; y < modeConfig.height; y++) {
    for (let x = 0; x < widthInBytes; x++) {
      const px = x * pixelsPerByte
      const byte = encodeByte(
        indexBuf,
        px,
        y,
        modeConfig.mode,
        modeConfig.width
      )
      const addr = computeCPCAddress(x, y, widthInBytes)
      scr[addr] = byte
    }
  }

  return scr
}
