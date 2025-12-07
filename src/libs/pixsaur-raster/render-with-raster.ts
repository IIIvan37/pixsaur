import type { Vector } from '../pixsaur-color/src/type'
import type { RasterChange } from './types'

/**
 * Render a preview image with raster effects applied.
 *
 * This function takes an index buffer (where each pixel contains an ink index 0-15)
 * and renders it to RGB using the appropriate palette for each line based on
 * the raster changes defined.
 *
 * This is exactly how CPC hardware works: the raster changes the ink definition,
 * not the image data itself.
 *
 * When a change is applied, the ink keeps its new color until
 * another change on the same ink explicitly modifies it.
 *
 * @param indexBuffer - Array of ink indices (0-15) for each pixel
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param globalPalette - Base palette (16 colors as RGB vectors)
 * @param rasterChanges - User-defined raster changes
 * @returns RGBA pixel data for display
 */
export function renderPreviewWithRaster(
  indexBuffer: Uint8Array,
  width: number,
  height: number,
  globalPalette: Vector[],
  rasterChanges: RasterChange[]
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * 4)

  // Build a map of line -> changes that occur on this line
  const changesByLine: Map<number, RasterChange[]> = new Map()
  for (const change of rasterChanges) {
    if (!changesByLine.has(change.line)) {
      changesByLine.set(change.line, [])
    }
    changesByLine.get(change.line)!.push(change)
  }

  // Current palette state - starts as a copy of global palette
  // This persists across lines
  const currentPalette: Vector[] = globalPalette.map((c) => [...c] as Vector)

  for (let y = 0; y < height; y++) {
    // Apply any changes that occur on this line
    const lineChanges = changesByLine.get(y)
    if (lineChanges) {
      for (const change of lineChanges) {
        currentPalette[change.inkIndex] = [...change.color] as Vector
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
  rasterChanges: RasterChange[]
): ImageData {
  const pixels = renderPreviewWithRaster(
    indexBuffer,
    width,
    height,
    globalPalette,
    rasterChanges
  )
  // Créer un ImageData vide puis copier les pixels
  const imageData = new ImageData(width, height)
  imageData.data.set(pixels)
  return imageData
}
