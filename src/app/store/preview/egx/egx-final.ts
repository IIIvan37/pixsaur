/**
 * EGX Final Output and Export
 *
 * Final preview image with manual edits and export data generation.
 */

import { atom } from 'jotai'
import { egxEnabledAtom, egxPreviewModeAtom } from '../../config/config'
import { egxConfigAtom } from './egx-config'
import { finalEgxIndexBufferAtom } from './egx-index-buffer'

/**
 * Whether a line must be greyed out: the preview modes `lowLines`/`highLines`
 * show only the lines of one EGX resolution and mask the other half.
 */
function shouldGrayOut(previewMode: string, isLowResLine: boolean): boolean {
  return (
    (previewMode === 'lowLines' && !isLowResLine) ||
    (previewMode === 'highLines' && isLowResLine)
  )
}

/**
 * Final EGX preview ImageData with manual edits applied.
 * Converts the finalEgxIndexBufferAtom to ImageData for display.
 * Also applies the preview mode masking (lowLines/highLines).
 */
export const finalEgxPreviewImageAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const bufferData = await get(finalEgxIndexBufferAtom)
  if (!bufferData) return null

  const { buffer, width, height, palette } = bufferData
  const previewMode = get(egxPreviewModeAtom)
  const config = get(egxConfigAtom)

  // Create ImageData from index buffer and palette
  const imageData = new ImageData(width, height)
  const data = imageData.data

  for (let y = 0; y < height; y++) {
    const isLowResLine =
      (config.firstLineMode === 'low' && y % 2 === 0) ||
      (config.firstLineMode === 'high' && y % 2 !== 0)

    // Check if this line should be masked
    const shouldMask = shouldGrayOut(previewMode, isLowResLine)

    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const pixelIndex = i * 4

      if (shouldMask) {
        // Black out masked lines
        data[pixelIndex] = 0
        data[pixelIndex + 1] = 0
        data[pixelIndex + 2] = 0
      } else {
        const inkIndex = buffer[i]
        const color = palette[inkIndex] ?? [0, 0, 0]
        data[pixelIndex] = color[0]
        data[pixelIndex + 1] = color[1]
        data[pixelIndex + 2] = color[2]
      }
      data[pixelIndex + 3] = 255
    }
  }

  return imageData
})

/**
 * Export data for EGX mode.
 * Provides all data needed for exporting: index buffer, palette, and config.
 */
export const egxExportDataAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const bufferData = await get(finalEgxIndexBufferAtom)
  const config = get(egxConfigAtom)

  if (!bufferData) return null

  return {
    indexBuffer: bufferData.buffer,
    palette: bufferData.palette,
    width: bufferData.width,
    height: bufferData.height,
    config
  }
})
