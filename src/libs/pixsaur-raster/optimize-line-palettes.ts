import type { Vector } from '../pixsaur-color/src/type'
import type { RasterChange } from './types'

/**
 * Quantize an RGB color to CPC Plus 4-bit format (16 levels per component)
 */
function quantizeToCPCPlus(color: Vector<'RGB'>): Vector<'RGB'> {
  const quantize = (v: number) => Math.round(v / 17) * 17
  return [quantize(color[0]), quantize(color[1]), quantize(color[2])]
}

/**
 * Check if two colors are equal
 */
function colorsEqual(a: Vector<'RGB'>, b: Vector<'RGB'>): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

/**
 * Convert color to string key for Set/Map operations
 */
function colorKey(color: Vector<'RGB'>): string {
  return `${color[0]},${color[1]},${color[2]}`
}

/**
 * Extract unique colors from a single line of the image.
 * Returns up to maxColors unique colors found on this line.
 */
function extractLineColors(
  sourceImage: ImageData,
  line: number,
  maxColors: number = 4
): Vector<'RGB'>[] {
  const { width, data } = sourceImage
  const lineStart = line * width * 4
  const colorSet = new Set<string>()
  const colors: Vector<'RGB'>[] = []

  for (let x = 0; x < width; x++) {
    const idx = lineStart + x * 4
    const color: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]
    const key = colorKey(color)

    if (!colorSet.has(key)) {
      colorSet.add(key)
      colors.push(color)

      // Stop if we've found maxColors
      if (colors.length >= maxColors) break
    }
  }

  return colors
}

/**
 * Find the best assignment of line colors to ink indices.
 * Tries to minimize changes from the previous palette by matching similar colors.
 *
 * @param lineColors - Colors found on this line (up to 4)
 * @param previousPalette - The palette from the previous line
 * @returns New palette with lineColors assigned to ink indices
 */
function assignColorsToInks(
  lineColors: Vector<'RGB'>[],
  previousPalette: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  const numInks = previousPalette.length
  const newPalette = previousPalette.map((c) => [...c]) as Vector<'RGB'>[]

  // If no colors on this line, keep previous palette
  if (lineColors.length === 0) {
    return newPalette
  }

  // Track which line colors have been assigned and which inks are used
  const assignedColors = new Set<string>()
  const usedInks = new Set<number>()

  // First pass: exact matches - keep colors in the same ink position
  for (let inkIndex = 0; inkIndex < numInks; inkIndex++) {
    const prevColor = previousPalette[inkIndex]
    const prevKey = colorKey(prevColor)

    for (const lineColor of lineColors) {
      const lineKey = colorKey(lineColor)
      if (lineKey === prevKey && !assignedColors.has(lineKey)) {
        // Exact match - keep in same position
        newPalette[inkIndex] = lineColor
        assignedColors.add(lineKey)
        usedInks.add(inkIndex)
        break
      }
    }
  }

  // Second pass: assign remaining line colors to unused ink slots
  for (const lineColor of lineColors) {
    const lineKey = colorKey(lineColor)
    if (assignedColors.has(lineKey)) continue

    // Find first unused ink slot
    for (let inkIndex = 0; inkIndex < numInks; inkIndex++) {
      if (!usedInks.has(inkIndex)) {
        newPalette[inkIndex] = lineColor
        assignedColors.add(lineKey)
        usedInks.add(inkIndex)
        break
      }
    }
  }

  return newPalette
}

/**
 * Result of line palette optimization including both raster changes and index buffer
 */
export interface OptimizationResult {
  changes: Omit<RasterChange, 'id'>[]
  indexBuffer: Uint8Array
  /** The quantized global palette used as starting point */
  quantizedGlobalPalette: Vector<'RGB'>[]
}

/**
 * Main optimization function for images that already respect the 4-colors-per-line constraint.
 *
 * This algorithm:
 * 1. For each line, extracts the unique colors present (max 4)
 * 2. Assigns these colors to ink indices, trying to minimize changes from previous line
 * 3. Generates raster changes where ink colors differ from the previous line
 * 4. Creates an index buffer where each pixel maps to its ink index
 *
 * This approach works best when the source image already has ≤4 colors per line,
 * as it will perfectly reproduce such images.
 *
 * @param sourceImage - The source image (should have ≤4 colors per line for best results)
 * @param globalPalette - Initial 4-color palette (used for line 0)
 * @param existingChanges - Existing raster changes to preserve
 * @returns Object with raster changes and matching index buffer
 */
export function optimizeLinePalettesWithIndexBuffer(
  sourceImage: ImageData,
  globalPalette: Vector<'RGB'>[],
  existingChanges: Omit<RasterChange, 'id'>[] = []
): OptimizationResult {
  const { width, height: imageHeight, data } = sourceImage
  const numInks = Math.min(globalPalette.length, 4)
  const changes: Omit<RasterChange, 'id'>[] = []
  const indexBuffer = new Uint8Array(width * imageHeight)

  // Create a set of existing changes for fast lookup
  const existingChangeSet = new Set(
    existingChanges.map((c) => `${c.line}-${c.inkIndex}`)
  )

  // Initialize with global palette (quantized to CPC Plus)
  let currentPalette = globalPalette
    .slice(0, numInks)
    .map((c) => quantizeToCPCPlus(c))

  // Pad to 4 colors if needed
  while (currentPalette.length < 4) {
    currentPalette.push([0, 0, 0])
  }

  // Process each line
  for (let line = 0; line < imageHeight; line++) {
    // Extract unique colors from this line
    const lineColors = extractLineColors(sourceImage, line, 4)

    // Quantize line colors to CPC Plus format
    const quantizedLineColors = lineColors.map((c) => quantizeToCPCPlus(c))

    // Assign colors to ink indices, minimizing changes from previous line
    const newPalette = assignColorsToInks(quantizedLineColors, currentPalette)

    // Generate raster changes for inks that changed
    for (let inkIndex = 0; inkIndex < numInks; inkIndex++) {
      const prevColor = currentPalette[inkIndex]
      const newColor = newPalette[inkIndex]

      // Skip if there's already an existing change at this line for this ink
      if (existingChangeSet.has(`${line}-${inkIndex}`)) continue

      // Check if color changed
      if (!colorsEqual(prevColor, newColor)) {
        changes.push({
          line,
          inkIndex,
          color: newColor
        })
      }
    }

    // Build color -> ink index map for this line
    const colorToInk = new Map<string, number>()
    for (let inkIndex = 0; inkIndex < newPalette.length; inkIndex++) {
      const key = colorKey(newPalette[inkIndex])
      if (!colorToInk.has(key)) {
        colorToInk.set(key, inkIndex)
      }
    }

    // Map each pixel on this line to its ink index
    const lineStart = line * width
    for (let x = 0; x < width; x++) {
      const pixelIdx = (lineStart + x) * 4
      const pixelColor: Vector<'RGB'> = [
        data[pixelIdx],
        data[pixelIdx + 1],
        data[pixelIdx + 2]
      ]
      const quantizedPixel = quantizeToCPCPlus(pixelColor)
      const key = colorKey(quantizedPixel)

      // Find the ink index for this color
      const inkIndex = colorToInk.get(key)
      indexBuffer[lineStart + x] = inkIndex ?? 0
    }

    // Update current palette for next line
    currentPalette = newPalette
  }

  // Combine with existing changes
  const allChanges = [...existingChanges, ...changes]

  // The quantized global palette that was used as starting point
  // (needed for the renderer to start with the correct palette)
  const quantizedGlobal = globalPalette
    .slice(0, Math.min(globalPalette.length, 4))
    .map((c) => quantizeToCPCPlus(c))
  while (quantizedGlobal.length < 4) {
    quantizedGlobal.push([0, 0, 0])
  }

  // Sort by line
  return {
    changes: allChanges.sort((a, b) => a.line - b.line),
    indexBuffer,
    quantizedGlobalPalette: quantizedGlobal
  }
}

/**
 * Legacy function - wraps optimizeLinePalettesWithIndexBuffer for backward compatibility
 */
export function optimizeLinePalettes(
  sourceImage: ImageData,
  _indexBuffer: Uint8Array, // Not used in this approach, kept for API compatibility
  _width: number, // Not used, we get it from sourceImage
  _height: number, // Not used, we get it from sourceImage
  globalPalette: Vector<'RGB'>[],
  existingChanges: Omit<RasterChange, 'id'>[] = []
): Omit<RasterChange, 'id'>[] {
  const result = optimizeLinePalettesWithIndexBuffer(
    sourceImage,
    globalPalette,
    existingChanges
  )
  return result.changes
}

// Re-export types that may be used externally
export interface LinePaletteAnalysis {
  line: number
  colors: Vector<'RGB'>[]
  globalError: number
  optimizedError: number
  worthOptimizing: boolean
}

export interface OptimizeLinePalettesOptions {
  globalPalette: Vector<'RGB'>[]
  minErrorReduction?: number
  minAbsoluteError?: number
}

// Keep these exports for backward compatibility (simplified implementations)
export function analyzeLinePalettes(
  _imageData: ImageData,
  _options: OptimizeLinePalettesOptions
): LinePaletteAnalysis[] {
  // Deprecated - use optimizeLinePalettes directly
  return []
}

export function generateRasterChangesFromAnalysis(
  _analyses: LinePaletteAnalysis[],
  _globalPalette: Vector<'RGB'>[]
): Omit<RasterChange, 'id'>[] {
  // Deprecated - use optimizeLinePalettes directly
  return []
}
