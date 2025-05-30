import { CpcModeConfig } from '@/app/store/config/types'
import { encodeByte } from '../encode-byte'

export function exportLinearAsm(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig
): Uint8Array {
  const pixelsPerByte = [2, 4, 8][modeConfig.mode]
  const data = new Uint8Array(
    modeConfig.height * Math.floor(modeConfig.width / pixelsPerByte)
  ).fill(0)
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
      data[addr++] = byte
    }
  }

  return data
}
