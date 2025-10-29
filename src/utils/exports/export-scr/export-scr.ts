import type { CpcModeConfig } from '@/app/store/config/types'
import { encodeByte } from '../encode-byte'

function computeCPCAddress(x: number, y: number): number {
  return (y & 7) * 2048 + (y >> 3) * 80 + x
}
export function exportSCR(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig
): Uint8Array {
  // Check if mode is standard (required for SCR format)
  // SCR format requires standard 16KB screen dimensions
  const isStandardMode =
    !modeConfig.overscan &&
    ((modeConfig.mode === 0 &&
      modeConfig.width === 160 &&
      modeConfig.height === 200) ||
      (modeConfig.mode === 1 &&
        modeConfig.width === 320 &&
        modeConfig.height === 200) ||
      (modeConfig.mode === 2 &&
        modeConfig.width === 640 &&
        modeConfig.height === 200))

  if (!isStandardMode) {
    throw new Error(
      'SCR export only supports standard CPC screen dimensions (160x200, 320x200, or 640x200 without overscan)'
    )
  }

  const pixelsPerByte = [2, 4, 8][modeConfig.mode]
  const widthInBytes = modeConfig.width / pixelsPerByte

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
      const addr = computeCPCAddress(x, y)
      scr[addr] = byte
    }
  }

  return scr
}
