/**
 * EGX SCR Export
 *
 * Encodes an EGX image to CPC SCR format.
 * Each line is encoded according to its video mode:
 * - EGX1: Alternates Mode 0 (2 pixels/byte) and Mode 1 (4 pixels/byte)
 * - EGX2: Alternates Mode 1 (4 pixels/byte) and Mode 2 (8 pixels/byte)
 */

import type { EGXConfig, EGXType } from '@/libs/pixsaur-egx'
import { getModeForLine } from '@/libs/pixsaur-egx'
import { encodeByte } from '../encode-byte'
import { computeCPCAddress } from './export-scr'

/**
 * Get the number of pixels per byte for a given mode
 */
function getPixelsPerByteForMode(mode: 0 | 1 | 2): number {
  switch (mode) {
    case 0:
      return 2
    case 1:
      return 4
    case 2:
      return 8
  }
}

/**
 * Get the expected width for an EGX type
 */
export function getExpectedEgxWidth(type: EGXType): number {
  return type === 'egx1' ? 320 : 640
}

/**
 * Export an EGX image to SCR format.
 *
 * For EGX, the index buffer is always at high-resolution:
 * - EGX1: 320 pixels wide (Mode 1 resolution)
 * - EGX2: 640 pixels wide (Mode 2 resolution)
 *
 * On low-resolution lines (Mode 0 for EGX1, Mode 1 for EGX2):
 * - Adjacent buffer pixels have the same index (enforced by EGX pipeline)
 * - We use stride=2 to sample every 2nd pixel
 *
 * @param indexBuf The index buffer (at high-resolution)
 * @param width Buffer width (320 for EGX1, 640 for EGX2)
 * @param height Buffer height (typically 200)
 * @param config EGX configuration
 * @returns SCR data (16KB)
 */
export function exportEgxSCR(
  indexBuf: Uint8Array,
  width: number,
  height: number,
  config: EGXConfig
): Uint8Array {
  // Validate dimensions
  const expectedWidth = getExpectedEgxWidth(config.type)
  if (width !== expectedWidth || height !== 200) {
    throw new Error(
      `EGX SCR export requires ${expectedWidth}x200 dimensions, got ${width}x${height}`
    )
  }

  // SCR format is always 16384 bytes (16KB)
  const scr = new Uint8Array(16384).fill(0)

  // Determine high-res mode for this EGX type
  const highResMode = config.type === 'egx1' ? 1 : 2

  for (let y = 0; y < height; y++) {
    const lineMode = getModeForLine(y, config)
    const isLowResLine = lineMode !== highResMode

    // CPC always has 80 bytes per line regardless of mode
    const bytesPerLine = 80

    for (let byteX = 0; byteX < bytesPerLine; byteX++) {
      const pixelsPerByte = getPixelsPerByteForMode(lineMode)

      // For low-res lines, pixels are doubled in buffer, so we use stride=2
      // Buffer position: byteX * pixelsPerByte * stride
      const stride = isLowResLine ? 2 : 1
      const bufferPixelStart = byteX * pixelsPerByte * stride

      const byte = encodeByte(
        indexBuf,
        bufferPixelStart,
        y,
        lineMode,
        width,
        stride
      )

      const addr = computeCPCAddress(byteX, y)
      scr[addr] = byte
    }
  }

  return scr
}

/**
 * Export EGX to linear format (sequential bytes per line, no CPC entrelacement).
 * Useful for custom display routines.
 *
 * @param indexBuf The index buffer
 * @param width Buffer width
 * @param height Buffer height
 * @param config EGX configuration
 * @returns Linear data (80 bytes per line × height)
 */
export function exportEgxLinear(
  indexBuf: Uint8Array,
  width: number,
  height: number,
  config: EGXConfig
): Uint8Array {
  const bytesPerLine = 80 // Standard CPC line width
  const linear = new Uint8Array(bytesPerLine * height)

  // Determine high-res mode for this EGX type
  const highResMode = config.type === 'egx1' ? 1 : 2

  for (let y = 0; y < height; y++) {
    const lineMode = getModeForLine(y, config)
    const isLowResLine = lineMode !== highResMode
    const pixelsPerByte = getPixelsPerByteForMode(lineMode)

    // For low-res lines, pixels are doubled in buffer
    const stride = isLowResLine ? 2 : 1

    for (let byteX = 0; byteX < bytesPerLine; byteX++) {
      const bufferPixelStart = byteX * pixelsPerByte * stride

      const byte = encodeByte(
        indexBuf,
        bufferPixelStart,
        y,
        lineMode,
        width,
        stride
      )

      linear[y * bytesPerLine + byteX] = byte
    }
  }

  return linear
}
