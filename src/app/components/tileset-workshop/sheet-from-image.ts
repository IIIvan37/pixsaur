/**
 * Reads a decoded image into the RGBA sheet the conversion works on.
 *
 * At its own size, deliberately: the image workshop downscales to a logical
 * width, which would resample the sheet before it is cut and make two
 * identical tiles come out different — the deduplication of Q11 would go with
 * them.
 */

import type { TilesetSheet } from '@/tileset'

export function sheetFromImage(img: HTMLImageElement): TilesetSheet {
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return { width, height, data: new Uint8ClampedArray(0) }

  context.imageSmoothingEnabled = false
  context.drawImage(img, 0, 0)
  const { data } = context.getImageData(0, 0, width, height)

  return { width, height, data }
}
