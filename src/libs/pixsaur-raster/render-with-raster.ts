import { mapAndDitherWithDynamicPalette } from '../pixsaur-color/src/map/map-and-dither'
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
 * 2. Builds a palette lookup function that returns the effective palette for each line
 * 3. Applies the configured dithering algorithm to the entire image at once
 *    (allowing error diffusion between lines for Floyd-Steinberg, Atkinson, etc.)
 * 4. Returns an index buffer where each pixel maps to an ink index
 *
 * This allows the user-configured dithering (Floyd-Steinberg, Bayer, etc.)
 * to be applied AFTER raster optimization, using the correct palette for each line,
 * while preserving inter-line error diffusion for better visual quality.
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

  // Initialize palette state - starts as a copy of global palette
  // Fill with black if palette has fewer colors than nColors
  const basePalette: Vector[] = globalPalette.map((c) => [...c] as Vector)
  while (basePalette.length < nColors) {
    basePalette.push([0, 0, 0])
  }

  // Build palette lookup: for each line, compute its effective palette
  const paletteByLine: Vector[][] = []
  const currentPalette = basePalette.map((c) => [...c] as Vector)

  for (let y = 0; y < height; y++) {
    // Apply any raster changes for this line
    const lineChanges = changesByLine.get(y)
    if (lineChanges) {
      for (const change of lineChanges) {
        currentPalette[change.inkIndex] = [...change.color] as Vector
      }
    }

    // Store the effective palette for this line
    paletteByLine[y] = currentPalette.slice(0, nColors)
  }

  // Apply dithering to entire image with dynamic per-line palettes
  const ditheredImage = mapAndDitherWithDynamicPalette(
    data,
    width,
    height,
    (y: number) => paletteByLine[y],
    ditheringConfig,
    'RGB'
  )

  // Convert RGBA output to ink indices
  for (let y = 0; y < height; y++) {
    const linePalette = paletteByLine[y]

    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4
      const r = ditheredImage[pixelIdx]
      const g = ditheredImage[pixelIdx + 1]
      const b = ditheredImage[pixelIdx + 2]

      // Find which ink index in the line's palette matches this color
      let inkIndex = 0
      let bestDist = Number.POSITIVE_INFINITY
      for (let i = 0; i < linePalette.length; i++) {
        const pr = linePalette[i][0]
        const pg = linePalette[i][1]
        const pb = linePalette[i][2]
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
