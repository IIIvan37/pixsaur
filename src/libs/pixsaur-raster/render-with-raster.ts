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
 * Note: When a raster range ends, the ink keeps its modified color until
 * another raster range explicitly changes it. No automatic restore to base palette.
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

  // Sort ranges by startLine to process them in order
  const sortedRanges = [...rasterRanges].sort(
    (a, b) => a.startLine - b.startLine
  )

  // Build a map of line -> raster changes that START on this line
  const rasterStartsByLine: Map<number, RasterRange[]> = new Map()
  for (const range of sortedRanges) {
    if (!rasterStartsByLine.has(range.startLine)) {
      rasterStartsByLine.set(range.startLine, [])
    }
    rasterStartsByLine.get(range.startLine)!.push(range)
  }

  // Current palette state - starts as a copy of global palette
  // This persists across lines (no auto-restore)
  const currentPalette: Vector[] = globalPalette.map((c) => [...c] as Vector)

  // Track active ranges (ranges that have started but not yet ended)
  const activeRanges: Set<RasterRange> = new Set()

  for (let y = 0; y < height; y++) {
    // Check for ranges that START on this line
    const startingRanges = rasterStartsByLine.get(y)
    if (startingRanges) {
      for (const range of startingRanges) {
        // Apply the raster change to current palette
        currentPalette[range.inkIndex] = [...range.color] as Vector
        activeRanges.add(range)
      }
    }

    // Render pixels for this line using current palette state
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x
      const inkIndex = indexBuffer[pixelIndex]

      // Get color from the current palette
      const color = currentPalette[inkIndex] ?? [0, 0, 0]

      // Write RGBA to output
      const outputIndex = pixelIndex * 4
      output[outputIndex] = color[0] // R
      output[outputIndex + 1] = color[1] // G
      output[outputIndex + 2] = color[2] // B
      output[outputIndex + 3] = 255 // A (fully opaque)
    }

    // Remove ranges that END on this line (but don't restore color!)
    for (const range of activeRanges) {
      if (range.endLine === y) {
        activeRanges.delete(range)
        // Note: we intentionally do NOT restore currentPalette[range.inkIndex]
        // The color persists until another range changes it
      }
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
