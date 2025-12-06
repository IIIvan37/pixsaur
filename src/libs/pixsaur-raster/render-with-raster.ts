import type { Vector } from '../pixsaur-color/src/type'
import type { RasterRange } from './types'

/**
 * Render a preview image with raster effects applied.
 *
 * This function takes an index buffer (where each pixel contains an ink index 0-15)
 * and renders it to RGB using the appropriate palette for each line based on
 * the raster ranges defined.
 *
 * This is exactly how CPC hardware works: the raster changes the ink definition,
 * not the image data itself.
 *
 * @param indexBuffer - Array of ink indices (0-15) for each pixel
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param globalPalette - Base palette (16 colors as RGB vectors)
 * @param rasterRanges - User-defined raster ranges
 * @returns RGBA pixel data for display
 */
export function renderPreviewWithRaster(
  indexBuffer: Uint8Array,
  width: number,
  height: number,
  globalPalette: Vector[],
  rasterRanges: RasterRange[]
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * 4)

  // Pre-compute which ranges affect each line for performance
  const rangesByLine: Map<number, RasterRange[]> = new Map()
  for (const range of rasterRanges) {
    for (let y = range.startLine; y <= range.endLine && y < height; y++) {
      if (!rangesByLine.has(y)) {
        rangesByLine.set(y, [])
      }
      rangesByLine.get(y)!.push(range)
    }
  }

  for (let y = 0; y < height; y++) {
    // Build the effective palette for this line
    // Start with a copy of the global palette
    const linePalette: Vector[] = globalPalette.map((c) => [...c] as Vector)

    // Apply raster ranges that affect this line
    const activeRanges = rangesByLine.get(y)
    if (activeRanges) {
      for (const range of activeRanges) {
        linePalette[range.inkIndex] = range.color
      }
    }

    // Render pixels for this line
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x
      const inkIndex = indexBuffer[pixelIndex]

      // Get color from the line's palette
      const color = linePalette[inkIndex] ?? [0, 0, 0]

      // Write RGBA to output
      const outputIndex = pixelIndex * 4
      output[outputIndex] = color[0] // R
      output[outputIndex + 1] = color[1] // G
      output[outputIndex + 2] = color[2] // B
      output[outputIndex + 3] = 255 // A (fully opaque)
    }
  }

  return output
}

/**
 * Create an ImageData from the raster preview output
 */
export function createRasterPreviewImageData(
  indexBuffer: Uint8Array,
  width: number,
  height: number,
  globalPalette: Vector[],
  rasterRanges: RasterRange[]
): ImageData {
  const pixels = renderPreviewWithRaster(
    indexBuffer,
    width,
    height,
    globalPalette,
    rasterRanges
  )
  // Créer un ImageData vide puis copier les pixels
  const imageData = new ImageData(width, height)
  imageData.data.set(pixels)
  return imageData
}
