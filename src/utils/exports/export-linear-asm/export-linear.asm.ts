import { CpcModeConfig } from '@/app/store/config/types'
import { encodeByte } from '../encode-byte'

export function exportLinearAsm(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig
): Uint8Array {
  const scr = new Uint8Array(0x4000).fill(0)
  const pixelsPerByte = [2, 4, 8][modeConfig.mode]
  let addr = 0
  for (let y = 0; y < modeConfig.height; y++) {
    for (let x = 0; x < Math.floor(modeConfig.width / pixelsPerByte); x++) {
      const px = x * pixelsPerByte
      const byte = encodeByte(
        indexBuf,
        px,
        y,
        modeConfig.mode,
        modeConfig.width
      )
      scr[addr++] = byte
    }
  }

  return scr
}
