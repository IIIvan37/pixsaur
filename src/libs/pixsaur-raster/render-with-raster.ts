import { mapAndDither } from '../pixsaur-color/src/map/map-and-dither'
import type { DitheringConfig } from '../pixsaur-color/src/quant'
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

/**
 * Apply dithering to source image using per-line palettes from raster changes.
 *
 * This function:
 * 1. Takes the original source image (before raster optimization)
 * 2. For each line, determines the effective palette (base + raster changes)
 * 3. Applies the configured dithering algorithm line-by-line
 * 4. Returns an index buffer where each pixel maps to an ink index
 *
 * This allows the user-configured dithering (Floyd-Steinberg, Bayer, etc.)
 * to be applied AFTER raster optimization, using the correct palette for each line.
 *
 * @param sourceImage - Original source image (RGB)
 * @param globalPalette - Base palette (nColors as RGB vectors)
 * @param rasterChanges - Raster changes defining per-line palette modifications (without IDs)
 * @param ditheringConfig - Dithering mode and intensity from user config
 * @param nColors - Number of colors in the palette (4 for Mode 1, 16 for Mode 0)
 * @returns Index buffer where each pixel contains its ink index (0-nColors)
 */
export function applyDitheringWithRaster(
  sourceImage: ImageData,
  globalPalette: Vector[],
  rasterChanges: Array<Omit<RasterChange, 'id'>>,
  ditheringConfig: DitheringConfig,
  nColors: number
): Uint8Array {
  const { width, height, data } = sourceImage
  const indexBuffer = new Uint8Array(width * height)

  // Build a map of line -> changes that occur on this line
  const changesByLine: Map<number, Array<Omit<RasterChange, 'id'>>> = new Map()
  for (const change of rasterChanges) {
    if (!changesByLine.has(change.line)) {
      changesByLine.set(change.line, [])
    }
    changesByLine.get(change.line)!.push(change)
  }

  // Current palette state - starts as a copy of global palette
  // Fill with black if palette has fewer colors than nColors
  const currentPalette: Vector[] = globalPalette.map((c) => [...c] as Vector)
  while (currentPalette.length < nColors) {
    currentPalette.push([0, 0, 0])
  }

  // Process each line independently with its effective palette
  for (let y = 0; y < height; y++) {
    // Apply any raster changes for this line
    const lineChanges = changesByLine.get(y)
    if (lineChanges) {
      for (const change of lineChanges) {
        currentPalette[change.inkIndex] = [...change.color] as Vector
      }
    }

    // Extract this line from source image
    const lineData = new Uint8ClampedArray(width * 4)
    const sourceLineStart = y * width * 4
    for (let x = 0; x < width; x++) {
      const srcIdx = sourceLineStart + x * 4
      const dstIdx = x * 4
      lineData[dstIdx] = data[srcIdx]
      lineData[dstIdx + 1] = data[srcIdx + 1]
      lineData[dstIdx + 2] = data[srcIdx + 2]
      lineData[dstIdx + 3] = 255
    }

    // Apply dithering to this line using its effective palette
    const linePalette = currentPalette.slice(0, nColors)
    const ditheredLine = mapAndDither(
      lineData,
      width,
      1, // height = 1 (single line)
      linePalette,
      ditheringConfig,
      'RGB'
    )

    // Extract ink indices from dithered line
    // mapAndDither returns RGBA, we need to find which palette entry was used
    for (let x = 0; x < width; x++) {
      const pixelIdx = x * 4
      const r = ditheredLine[pixelIdx]
      const g = ditheredLine[pixelIdx + 1]
      const b = ditheredLine[pixelIdx + 2]

      // Find which ink index in currentPalette matches this color
      let inkIndex = 0
      let bestDist = Number.POSITIVE_INFINITY
      for (let i = 0; i < nColors; i++) {
        const pr = currentPalette[i][0]
        const pg = currentPalette[i][1]
        const pb = currentPalette[i][2]
        const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
        if (dist < bestDist) {
          bestDist = dist
          inkIndex = i
        }
      }

      indexBuffer[y * width + x] = inkIndex
    }
  }

  return indexBuffer
}
