import type { CpcModeConfig } from '@/app/store/config/types'
import { encodeByte } from '../encode-byte'

export function computeCPCAddress(
  x: number,
  y: number,
  bytesPerLine = 80
): number {
  return (y & 7) * 2048 + (y >> 3) * bytesPerLine + x
}
export function exportSCR(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig
): Uint8Array {
  const pixelsPerByte = [2, 4, 8][modeConfig.mode]
  const widthInBytes = modeConfig.width / pixelsPerByte

  // SCR format uses CPC interleaved screen memory layout (16KB max)
  // Validate that the max address fits within 16384 bytes
  const maxY = modeConfig.height - 1
  const maxAddress =
    (maxY & 7) * 2048 + (maxY >> 3) * widthInBytes + (widthInBytes - 1)
  const canExportSCR = !modeConfig.overscan && maxAddress < 16384

  if (!canExportSCR) {
    throw new Error(
      'SCR export requires dimensions fitting in 16KB CPC screen memory (no overscan)'
    )
  }

  // SCR format is always 16384 bytes (16KB)
  const scr = new Uint8Array(16384).fill(0)

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
