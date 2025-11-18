import type { CpcModeConfig } from '@/app/store/config/types'
import { getPixelsPerByte } from '@/export'
import { encodeByte } from '../encode-byte/encode-byte'

const MAX_CHUNKSize = 16 * 1024 // 16 Ko

export function exportLinearAsm(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig & { width: number; height: number }
): Uint8Array {
  const pixelsPerByte = getPixelsPerByte(modeConfig.mode)
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

/**
 * Split linear data into chunks of 16Ko max
 * Returns array of {data: Uint8Array, index: number} for each chunk
 * Index starts at 1 for human-readable filenames (_linear_1.asm, _linear_2.asm, etc.)
 */
export function splitLinearIntoChunks(
  data: Uint8Array
): Array<{ data: Uint8Array; index: number }> {
  if (data.length <= MAX_CHUNKSize) {
    return [{ data, index: 1 }]
  }

  const chunks: Array<{ data: Uint8Array; index: number }> = []
  let offset = 0
  let chunkIndex = 1 // Start at 1 for human-readable filenames

  while (offset < data.length) {
    const chunkSize = Math.min(MAX_CHUNKSize, data.length - offset)
    const chunk = data.slice(offset, offset + chunkSize)
    chunks.push({ data: chunk, index: chunkIndex })
    offset += chunkSize
    chunkIndex++
  }

  return chunks
}
