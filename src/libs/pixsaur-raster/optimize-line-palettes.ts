import { weightedRGBDistance } from '../pixsaur-color/src/metric/distance'
import { findClosestColorIndex } from '../pixsaur-color/src/metric/find-closest'
import type { Vector } from '../pixsaur-color/src/type'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PREPROCESS_CONTINUITY_BONUS,
  PREPROCESS_CONTINUITY_DISTANCE,
  PREPROCESS_FREQUENCY_EXPONENT,
  VERTICAL_ERROR_COEFFICIENT
} from './raster-constants'
import type { RasterChange } from './types'

/**
 * Mode 0 CPC Plus raster optimization constants.
 * The Gate Array can only modify 4 CONSECUTIVE ink registers per line.
 * Solution: Use indices 0-3 as raster slots (dynamic), indices 4-15 as fixed palette.
 */
export const MODE_0_RASTER_SLOTS = 4 // Indices 0-3: can change per line
export const MODE_0_FIXED_COLORS = 12 // Indices 4-15: fixed for entire image
export const MODE_0_TOTAL_COLORS = 16

/**
 * Detect if we're in Mode 0 CPC Plus (requires special raster handling)
 * CPC Classic doesn't have the consecutive ink constraint.
 */
function isMode0CPCPlus(
  nColors: number,
  cpcClassicPalette?: Vector<'RGB'>[]
): boolean {
  return nColors === MODE_0_TOTAL_COLORS && !cpcClassicPalette
}

/**
 * Runtime tuning values for dithering error propagation coefficients
 * Can be overridden by dev tools for fine-tuning visual quality
 */
export const rasterTuningOverrides = {
  // Dithering error propagation
  verticalErrorCoefficient: VERTICAL_ERROR_COEFFICIENT,
  horizontalErrorCoefficient: HORIZONTAL_ERROR_COEFFICIENT,

  // Preprocessing parameters (affects base palette extraction)
  preprocessContinuityDistance: PREPROCESS_CONTINUITY_DISTANCE,
  preprocessContinuityBonus: PREPROCESS_CONTINUITY_BONUS,
  preprocessFrequencyExponent: PREPROCESS_FREQUENCY_EXPONENT
}

/**
 * Quantize an RGB color to CPC Plus 4-bit format (16 levels per component)
 */
export function quantizeToCPCPlus(color: Vector<'RGB'>): Vector<'RGB'> {
  const quantize = (v: number) => Math.round(v / 17) * 17
  return [quantize(color[0]), quantize(color[1]), quantize(color[2])]
}

/**
 * Pre-computed lookup table for CPC Classic quantization.
 * Maps 4096 CPC Plus colors (16×16×16) to their closest CPC Classic palette index.
 * Built once when first needed, cached globally for performance.
 */
let cpcClassicLUT: Uint8Array | null = null
let cpcClassicLUTPalette: Vector<'RGB'>[] | null = null

/**
 * Build a lookup table that maps all 4096 CPC Plus colors to CPC Classic palette indices.
 * Each CPC Plus color (r,g,b where each component is 0,17,34,...,255) maps to the index
 * of the closest color in the 27-color CPC Classic palette.
 *
 * LUT size: 4096 bytes (16×16×16)
 * Index calculation: (r/17) * 256 + (g/17) * 16 + (b/17)
 */
function buildCPCClassicLUT(palette: Vector<'RGB'>[]): Uint8Array {
  const lut = new Uint8Array(4096)

  // For each of the 4096 possible CPC Plus colors
  for (let r = 0; r < 16; r++) {
    for (let g = 0; g < 16; g++) {
      for (let b = 0; b < 16; b++) {
        const color: Vector<'RGB'> = [r * 17, g * 17, b * 17]
        const closestIdx = findClosestColorIndex(
          color,
          palette,
          weightedRGBDistance
        )
        const lutIndex = r * 256 + g * 16 + b
        lut[lutIndex] = closestIdx
      }
    }
  }

  return lut
}

/**
 * Quantize a color to CPC Classic using pre-computed LUT (ultra-fast).
 * First quantizes to CPC Plus (16 levels), then looks up closest CPC Classic color.
 */
function quantizeToCPCClassicWithLUT(
  color: Vector<'RGB'>,
  palette: Vector<'RGB'>[],
  lut: Uint8Array
): Vector<'RGB'> {
  // Quantize to CPC Plus first (0, 17, 34, ..., 255)
  const r = Math.round(color[0] / 17)
  const g = Math.round(color[1] / 17)
  const b = Math.round(color[2] / 17)

  // Look up closest CPC Classic palette index
  const lutIndex = r * 256 + g * 16 + b
  const paletteIndex = lut[lutIndex]

  return palette[paletteIndex]
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
 * Add two error vectors (keep full precision for proper error diffusion)
 */
function addErrors(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/**
 * Weighted color pixel for median cut algorithm
 */
interface WeightedPixel {
  color: Vector<'RGB'>
  weight: number // frequency count
}

/**
 * Color box for median cut algorithm
 */
interface ColorBox {
  pixels: WeightedPixel[]
  rMin: number
  rMax: number
  gMin: number
  gMax: number
  bMin: number
  bMax: number
  totalWeight: number
}

/**
 * Calculate the bounds and total weight of a color box
 */
function calculateBoxBounds(pixels: WeightedPixel[]): ColorBox {
  let rMin = 255,
    rMax = 0,
    gMin = 255,
    gMax = 0,
    bMin = 255,
    bMax = 0
  let totalWeight = 0

  for (const p of pixels) {
    const [r, g, b] = p.color
    if (r < rMin) rMin = r
    if (r > rMax) rMax = r
    if (g < gMin) gMin = g
    if (g > gMax) gMax = g
    if (b < bMin) bMin = b
    if (b > bMax) bMax = b
    totalWeight += p.weight
  }

  return { pixels, rMin, rMax, gMin, gMax, bMin, bMax, totalWeight }
}

/**
 * Calculate the representative color of a box.
 * Returns the most frequent color in the box to preserve original colors.
 */
function boxRepresentativeColor(box: ColorBox): Vector<'RGB'> {
  if (box.pixels.length === 0) return [0, 0, 0]

  // Find the most frequent color in this box
  let maxWeight = 0
  let bestColor: Vector<'RGB'> = box.pixels[0].color

  for (const p of box.pixels) {
    if (p.weight > maxWeight) {
      maxWeight = p.weight
      bestColor = p.color
    }
  }

  return bestColor
}

/**
 * Split a color box at the median along its longest axis
 */
function splitBox(box: ColorBox): [ColorBox, ColorBox] | null {
  if (box.pixels.length < 2) return null

  const rRange = box.rMax - box.rMin
  const gRange = box.gMax - box.gMin
  const bRange = box.bMax - box.bMin

  // Find longest axis
  let axis: 0 | 1 | 2
  if (rRange >= gRange && rRange >= bRange) {
    axis = 0 // Red
  } else if (gRange >= rRange && gRange >= bRange) {
    axis = 1 // Green
  } else {
    axis = 2 // Blue
  }

  // Sort pixels by the chosen axis
  const sorted = [...box.pixels].sort((a, b) => a.color[axis] - b.color[axis])

  // Find median by cumulative weight
  let cumulativeWeight = 0
  const halfWeight = box.totalWeight / 2
  let medianIndex = 0

  for (let i = 0; i < sorted.length; i++) {
    cumulativeWeight += sorted[i].weight
    if (cumulativeWeight >= halfWeight) {
      medianIndex = Math.max(1, i) // Ensure at least 1 pixel in first box
      break
    }
  }

  // Ensure we don't have empty boxes
  if (medianIndex === 0) medianIndex = 1
  if (medianIndex >= sorted.length) medianIndex = sorted.length - 1

  const box1Pixels = sorted.slice(0, medianIndex)
  const box2Pixels = sorted.slice(medianIndex)

  if (box1Pixels.length === 0 || box2Pixels.length === 0) {
    return null
  }

  return [calculateBoxBounds(box1Pixels), calculateBoxBounds(box2Pixels)]
}

/**
 * Median cut algorithm to quantize colors to n representative colors.
 * Based on Heckbert's 1982 algorithm with weighted pixels.
 *
 * @param pixels - Array of weighted pixels (color + frequency)
 * @param numColors - Target number of colors (usually 4)
 * @returns Array of representative colors
 */
function medianCut(
  pixels: WeightedPixel[],
  numColors: number
): Vector<'RGB'>[] {
  if (pixels.length === 0) return []
  if (pixels.length <= numColors) {
    return pixels.map((p) => p.color)
  }

  // Initialize with one box containing all pixels
  const boxes: ColorBox[] = [calculateBoxBounds(pixels)]

  // Recursively split boxes until we have enough
  while (boxes.length < numColors) {
    // Find box with largest volume (range) to split
    // Prioritize boxes with larger volume * weight product
    let bestIndex = 0
    let bestScore = -1

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]
      if (box.pixels.length < 2) continue

      const rRange = box.rMax - box.rMin
      const gRange = box.gMax - box.gMin
      const bRange = box.bMax - box.bMin
      const volume = rRange + gRange + bRange // Sum of ranges
      const score = volume * Math.log(box.totalWeight + 1)

      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    const boxToSplit = boxes[bestIndex]
    const splitResult = splitBox(boxToSplit)

    if (!splitResult) {
      // Can't split further
      break
    }

    // Replace the split box with two new boxes
    boxes.splice(bestIndex, 1, splitResult[0], splitResult[1])
  }

  // Calculate representative color for each box
  return boxes.map(boxRepresentativeColor)
}

/**
 * Extract all unique colors from a single line with their frequencies.
 */
function extractLineColorFrequencies(
  sourceImage: ImageData,
  line: number
): Map<string, { color: Vector<'RGB'>; count: number }> {
  const { width, data } = sourceImage
  const lineStart = line * width * 4

  const colorFrequency = new Map<
    string,
    { color: Vector<'RGB'>; count: number }
  >()

  for (let x = 0; x < width; x++) {
    const idx = lineStart + x * 4
    const color: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]
    const key = colorKey(color)

    const existing = colorFrequency.get(key)
    if (existing) {
      existing.count++
    } else {
      colorFrequency.set(key, { color, count: 1 })
    }
  }

  return colorFrequency
}

/**
 * Posterize an image to reduce color count while preserving important transitions.
 * This is a crucial preprocessing step for raster optimization.
 *
 * The posterization works by:
 * 1. Quantizing each pixel to fewer levels per channel
 * 2. Using the global palette as "anchor" colors that are preserved exactly
 * 3. Mapping similar colors to the nearest anchor or posterized value
 *
 * @param sourceImage - The source image to posterize
 * @param levels - Number of levels per channel (default 8 = 512 possible colors)
 * @param globalPalette - Optional anchor colors to preserve exactly
 * @returns Posterized ImageData
 */
export function posterizeImage(
  sourceImage: ImageData,
  levels: number = 8,
  globalPalette: Vector<'RGB'>[] = []
): ImageData {
  const { width, height, data } = sourceImage
  const outputData = new Uint8ClampedArray(data.length)

  // Calculate step size for posterization
  // For levels=8: step=32, values are 0,32,64,96,128,160,192,224
  const step = Math.floor(256 / levels)

  // Quantize to posterized value
  const posterize = (v: number): number => {
    const level = Math.round(v / step)
    return Math.min(255, level * step)
  }

  // If we have anchor colors, we'll snap nearby colors to them
  const anchorThreshold = step * step * 3 // Distance threshold for snapping

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    // Check if this color is close to any anchor color
    let snappedToAnchor = false
    for (const anchor of globalPalette) {
      const dr = r - anchor[0]
      const dg = g - anchor[1]
      const db = b - anchor[2]
      const dist = dr * dr + dg * dg + db * db

      if (dist <= anchorThreshold) {
        // Snap to anchor color
        outputData[i] = anchor[0]
        outputData[i + 1] = anchor[1]
        outputData[i + 2] = anchor[2]
        outputData[i + 3] = a
        snappedToAnchor = true
        break
      }
    }

    if (!snappedToAnchor) {
      // Apply standard posterization
      outputData[i] = posterize(r)
      outputData[i + 1] = posterize(g)
      outputData[i + 2] = posterize(b)
      outputData[i + 3] = a
    }
  }

  return new ImageData(outputData, width, height)
}

/**
 * Helper to create a quantization function based on hardware mode
 */
function createQuantizeFunction(
  cpcClassicPalette?: Vector<'RGB'>[],
  cpcClassicLUT?: Uint8Array | null
): (color: Vector<'RGB'>) => Vector<'RGB'> {
  if (cpcClassicPalette && cpcClassicLUT) {
    return (color: Vector<'RGB'>) =>
      quantizeToCPCClassicWithLUT(color, cpcClassicPalette, cpcClassicLUT)
  }
  return quantizeToCPCPlus
}

/**
 * Extract the best global palette from the source image.
 * This analyzes the ENTIRE image and selects the 4 most representative colors.
 *
 * This is used to override any externally-provided palette that might contain
 * colors not actually present in the image (like the green issue).
 *
 * @param sourceImage - The source image to analyze
 * @param maxColors - Maximum colors to extract (default 4)
 * @returns Array of representative colors, quantized to CPC Plus
 */
export function extractGlobalPaletteFromImage(
  sourceImage: ImageData,
  maxColors: number = 4,
  cpcClassicPalette?: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  const { width, height, data } = sourceImage

  // Build LUT for CPC Classic if needed (done once, cached globally)
  if (cpcClassicPalette) {
    if (!cpcClassicLUT || cpcClassicLUTPalette !== cpcClassicPalette) {
      cpcClassicLUT = buildCPCClassicLUT(cpcClassicPalette)
      cpcClassicLUTPalette = cpcClassicPalette
    }
  }

  // Helper to quantize based on hardware mode (with LUT for CPC Classic)
  const quantize = createQuantizeFunction(cpcClassicPalette, cpcClassicLUT)

  // Build histogram of all colors in the image
  const colorFrequency = new Map<
    string,
    { color: Vector<'RGB'>; count: number }
  >()

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const color: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]
      // Quantize immediately to hardware palette to reduce unique colors
      const quantized = quantize(color)
      const key = colorKey(quantized)

      const existing = colorFrequency.get(key)
      if (existing) {
        existing.count++
      } else {
        colorFrequency.set(key, { color: quantized, count: 1 })
      }
    }
  }

  // If we have <= maxColors unique quantized colors, return them all
  if (colorFrequency.size <= maxColors) {
    return Array.from(colorFrequency.values())
      .sort((a, b) => b.count - a.count)
      .map((v) => v.color)
  }

  // Use farthest point sampling to select the best colors
  // This uses the preprocessing tuning parameters (continuityDistance, continuityBonus, frequencyExponent)
  // Note: previousPalette is null for global extraction (no continuity context)
  return selectPaletteFarthestPoint(colorFrequency, maxColors, null)
}

/**
 * NOTE: Dithering constants are now centralized in raster-constants.ts
 * These control Floyd-Steinberg error propagation coefficients:
 * - VERTICAL_ERROR_COEFFICIENT: Error diffusion to pixels below (default: 1/8)
 * - HORIZONTAL_ERROR_COEFFICIENT: Error diffusion to adjacent pixels (default: 1/2)
 */

/**
 * Extract global colors for Mode 0 CPC Plus raster optimization.
 * Uses a "globalScore" that favors colors appearing on many lines (not just total pixel count).
 *
 * Algorithm from MODE_0_RASTER_OPTIMIZATION.md:
 * 1. Quantize image to ~24-32 intermediate colors
 * 2. For each color: count total pixels AND number of lines where it appears
 * 3. globalScore = w1 * pixelCount + w2 * lineCount (w1=1, w2=2)
 * 4. Return top N colors by globalScore (N = numFixedColors)
 *
 * @param sourceImage - Source image to analyze
 * @param cpcClassicPalette - CPC Classic palette (should be undefined for CPC Plus)
 * @param numFixedColors - Number of fixed colors to extract (16 - maxChangesPerLine)
 * @returns N colors ordered by globalScore (most global first)
 */
function extractGlobalColorsForMode0Plus(
  sourceImage: ImageData,
  cpcClassicPalette?: Vector<'RGB'>[],
  numFixedColors: number = MODE_0_FIXED_COLORS
): Vector<'RGB'>[] {
  const { width, height, data } = sourceImage

  // Build LUT for CPC Classic if needed (should not happen for CPC Plus)
  if (cpcClassicPalette) {
    if (!cpcClassicLUT || cpcClassicLUTPalette !== cpcClassicPalette) {
      cpcClassicLUT = buildCPCClassicLUT(cpcClassicPalette)
      cpcClassicLUTPalette = cpcClassicPalette
    }
  }

  // Helper to quantize based on hardware mode
  const quantize = createQuantizeFunction(cpcClassicPalette, cpcClassicLUT)

  // Track color statistics: pixelCount AND lineCount
  const colorStats = new Map<
    string,
    {
      color: Vector<'RGB'>
      pixelCount: number
      lines: Set<number> // track which lines this color appears on
    }
  >()

  // Scan entire image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const color: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]
      const quantized = quantize(color)
      const key = colorKey(quantized)

      const existing = colorStats.get(key)
      if (existing) {
        existing.pixelCount++
        existing.lines.add(y)
      } else {
        colorStats.set(key, {
          color: quantized,
          pixelCount: 1,
          lines: new Set([y])
        })
      }
    }
  }

  // Calculate globalScore and sort
  // globalScore = w1 * pixelCount + w2 * lineCount
  // w2 is weighted higher to favor colors that span many lines
  const W1 = 1 // Pixel frequency weight
  const W2 = 2 // Line coverage weight

  const colorScores = Array.from(colorStats.values())
    .map((stats) => ({
      color: stats.color,
      pixelCount: stats.pixelCount,
      lineCount: stats.lines.size,
      globalScore: W1 * stats.pixelCount + W2 * stats.lines.size * (width / 4) // normalize lineCount
    }))
    .sort((a, b) => b.globalScore - a.globalScore)

  // If we have <= numFixedColors colors, return them all
  if (colorScores.length <= numFixedColors) {
    return colorScores.map((c) => c.color)
  }

  // Use median cut to reduce to numFixedColors if there are too many
  // This provides better color distribution than just taking top N by score
  const topCandidates = colorScores.slice(0, numFixedColors * 2) // Take top 2N candidates
  const pixels: WeightedPixel[] = topCandidates.map((c) => ({
    color: c.color,
    weight: c.globalScore
  }))

  return medianCut(pixels, numFixedColors)
}

/**
 * Select the best colors for a line based on color frequencies
 *
 * Since preprocessImageForRaster always reduces each line to exactly 4 colors
 * via Floyd-Steinberg dithering + Farthest Point Sampling, this function
 * @param maxColors - Maximum colors to select (default 4)
 * @returns Selected colors for this line
 */
/**
 * Select the best colors for a line based on color frequencies
 *
 * Since preprocessImageForRaster always reduces each line to exactly 4 colors
 * via Floyd-Steinberg dithering + Farthest Point Sampling, this function
 * always returns immediately with the line colors.
 *
 * The extensive palette optimization logic below (coverage checks, median cut,
 * replacement distance) is never executed in practice.
 */
function selectBestColorsForLine(
  colorFrequencies: Map<string, { color: Vector<'RGB'>; count: number }>,
  _currentPalette: Vector<'RGB'>[],
  _basePalette: Vector<'RGB'>[] | null = null,
  maxColors: number = 4,
  _cpcClassicPalette?: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  // preprocessImageForRaster guarantees colorFrequencies.size <= maxColors (always 4)
  // So this always executes and returns immediately
  if (colorFrequencies.size <= maxColors) {
    return Array.from(colorFrequencies.values()).map((v) => v.color)
  }

  // Dead code: never reached because preprocessing guarantees ≤4 colors per line
  // Kept for historical reference but could be removed entirely
  throw new Error(
    'selectBestColorsForLine: Unexpected >4 colors per line. ' +
      'This indicates preprocessImageForRaster is not reducing to 4 colors.'
  )
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
 * Options for line palette optimization
 */
export interface OptimizationOptions {
  /** Maximum number of ink changes per line (1 = classic raster, 4 = full raster) */
  maxChangesPerLine?: number
  /**
   * Number of colors per line for the current CPC mode.
   * Mode 0: 16 colors, Mode 1: 4 colors, Mode 2: 2 colors.
   * Default: 4 (Mode 1)
   */
  nColors?: number
  /**
   * CPC Classic hardware palette (27 colors).
   * When provided, colors are constrained to this fixed palette instead of
   * using CPC Plus 4096-color quantization.
   */
  cpcClassicPalette?: Vector<'RGB'>[]
  /**
   * Use the provided global palette instead of extracting it from the image.
   * When true, the globalPalette parameter will be used directly as the base palette.
   * This allows reusing the same quantization as the non-raster mode.
   * Default: false (extract from image)
   */
  useProvidedPalette?: boolean
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
 * @param globalPalette - Initial palette (used for line 0). When useProvidedPalette is true,
 *                        this palette is used directly instead of extracting from image.
 * @param existingChanges - Existing raster changes to preserve
 * @param options - Optimization options (maxChangesPerLine, useProvidedPalette, etc.)
 */
export function optimizeLinePalettesWithIndexBuffer(
  preprocessedImage: ImageData,
  globalPalette: Vector<'RGB'>[],
  existingChanges: Omit<RasterChange, 'id'>[] = [],
  options: OptimizationOptions = {}
): OptimizationResult {
  const {
    maxChangesPerLine = 4,
    nColors = 4,
    cpcClassicPalette,
    useProvidedPalette = false
  } = options
  const { width, height: imageHeight, data } = preprocessedImage

  const changes: Omit<RasterChange, 'id'>[] = []
  const indexBuffer = new Uint8Array(width * imageHeight)

  // Build LUT for CPC Classic if needed (done once, cached globally)
  if (cpcClassicPalette) {
    if (!cpcClassicLUT || cpcClassicLUTPalette !== cpcClassicPalette) {
      cpcClassicLUT = buildCPCClassicLUT(cpcClassicPalette)
      cpcClassicLUTPalette = cpcClassicPalette
    }
  }

  // Helper function to quantize a color based on hardware mode
  // CPC Classic: use pre-computed LUT (ultra-fast array lookup)
  // CPC Plus: quantize to 4096 colors (4 bits per channel)
  // Use shared quantize function for hardware mode
  const quantizeColor = createQuantizeFunction(cpcClassicPalette, cpcClassicLUT)

  // Create a set of existing changes for fast lookup
  const existingChangeSet = new Set(
    existingChanges.map((c) => `${c.line}-${c.inkIndex}`)
  )

  // Detect Mode 0 CPC Plus for special raster handling
  // In Mode 0 CPC Plus, the Gate Array can only modify N CONSECUTIVE ink registers per line
  // where N = maxChangesPerLine (1-4)
  // Solution: indices 0 to (N-1) = raster slots (dynamic), indices N to 15 = fixed palette
  const isMode0Plus = isMode0CPCPlus(nColors, cpcClassicPalette)

  // For Mode 0 CPC Plus: extract global colors for fixed palette
  // For other modes: use standard extraction or provided palette
  let basePalette: Vector<'RGB'>[]
  let rasterSlotStart: number
  let rasterSlotEnd: number

  if (isMode0Plus) {
    // Mode 0 CPC Plus: dynamic split based on maxChangesPerLine
    // - Raster slots: indices 0 to (maxChangesPerLine - 1)
    // - Fixed colors: indices maxChangesPerLine to 15
    const numRasterSlots = Math.min(maxChangesPerLine, MODE_0_RASTER_SLOTS)
    const numFixedColors = MODE_0_TOTAL_COLORS - numRasterSlots

    // Use provided palette if available, otherwise extract
    let globalColors: Vector<'RGB'>[]
    if (useProvidedPalette && globalPalette.length > 0) {
      // Handle different palette sizes
      if (globalPalette.length === numFixedColors) {
        // Exact match: use directly as fixed palette
        globalColors = globalPalette.map((c) => quantizeColor(c))
      } else if (globalPalette.length >= MODE_0_TOTAL_COLORS) {
        // Full 16 colors provided: take colors starting from numRasterSlots
        globalColors = globalPalette
          .slice(numRasterSlots, MODE_0_TOTAL_COLORS)
          .map((c) => quantizeColor(c))
      } else {
        // Fallback: use what we have, pad with extracted colors
        globalColors = globalPalette.map((c) => quantizeColor(c))
        if (globalColors.length < numFixedColors) {
          const extracted = extractGlobalColorsForMode0Plus(
            preprocessedImage,
            cpcClassicPalette,
            numFixedColors
          )
          while (globalColors.length < numFixedColors) {
            globalColors.push(extracted[globalColors.length] || [0, 0, 0])
          }
        }
      }
    } else {
      globalColors = extractGlobalColorsForMode0Plus(
        preprocessedImage,
        cpcClassicPalette,
        numFixedColors
      )
    }

    // Build palette: [slot0, ..., slot(N-1), fixedN, fixedN+1, ..., fixed15]
    basePalette = new Array(MODE_0_TOTAL_COLORS)

    // Indices 0 to (numRasterSlots-1): raster slots (initialized to black, will change per line)
    for (let i = 0; i < numRasterSlots; i++) {
      basePalette[i] = [0, 0, 0]
    }

    // Indices numRasterSlots to 15: fixed global colors
    for (let i = 0; i < numFixedColors; i++) {
      basePalette[numRasterSlots + i] = globalColors[i] || [0, 0, 0]
    }

    // Only indices 0 to (numRasterSlots-1) can be modified by raster changes
    rasterSlotStart = 0
    rasterSlotEnd = numRasterSlots
  } else {
    // Standard mode: use provided palette if available, otherwise extract
    let extractedPalette: Vector<'RGB'>[]
    if (useProvidedPalette && globalPalette.length >= nColors) {
      // Use the provided palette directly, quantize to ensure hardware compatibility
      extractedPalette = globalPalette
        .slice(0, nColors)
        .map((c) => quantizeColor(c))
    } else {
      extractedPalette = extractGlobalPaletteFromImage(
        preprocessedImage,
        nColors,
        cpcClassicPalette
      )
    }
    basePalette = [...extractedPalette]

    // Pad to nColors if needed
    while (basePalette.length < nColors) {
      basePalette.push([0, 0, 0])
    }

    // All indices can be modified
    rasterSlotStart = 0
    rasterSlotEnd = nColors
  }

  // Current palette starts from base and evolves line by line
  let currentPalette = [...basePalette]

  // Process each line
  for (let line = 0; line < imageHeight; line++) {
    // Extract color frequencies from this line using the ANALYSIS IMAGE
    // This gives us the true colors the user wants to represent
    const colorFrequencies = extractLineColorFrequencies(
      preprocessedImage,
      line
    )

    let newPalette: Vector<'RGB'>[]

    if (isMode0Plus) {
      // MODE 0 CPC PLUS: Special handling for fixed + raster slots
      // Find the best colors for raster slots (0 to rasterSlotEnd-1) that complement the fixed colors

      // Fixed palette (indices rasterSlotEnd to 15)
      const fixedPalette = basePalette.slice(rasterSlotEnd)

      // Find colors that are NOT well covered by the fixed palette
      // These should go into the raster slots
      const uncoveredColors: Array<{
        color: Vector<'RGB'>
        error: number
        count: number
      }> = []

      for (const { color, count } of colorFrequencies.values()) {
        const quantized = quantizeColor(color)
        // Find closest color in fixed palette
        const closestFixedIdx = findClosestColorIndex(
          quantized,
          fixedPalette,
          weightedRGBDistance
        )
        const closestFixed = fixedPalette[closestFixedIdx]
        const error = weightedRGBDistance(quantized, closestFixed)

        // If error is significant, this color needs a raster slot
        if (error > 0) {
          uncoveredColors.push({
            color: quantized,
            error,
            count
          })
        }
      }

      // Sort by error * count (colors with high error AND high frequency are prioritized)
      uncoveredColors.sort((a, b) => b.error * b.count - a.error * a.count)

      // Select up to rasterSlotEnd colors for raster slots (respects maxChangesPerLine)
      const rasterColors: Vector<'RGB'>[] = []
      const usedKeys = new Set<string>()

      for (const { color } of uncoveredColors) {
        if (rasterColors.length >= rasterSlotEnd) break
        const key = colorKey(color)
        if (!usedKeys.has(key)) {
          rasterColors.push(color)
          usedKeys.add(key)
        }
      }

      // Build new palette: raster slots + fixed colors
      newPalette = [...currentPalette]

      // Assign raster colors to slots 0 to (rasterSlotEnd-1), trying to minimize changes from previous line
      const previousRasterSlots = currentPalette.slice(0, rasterSlotEnd)
      const assignedSlots = new Set<number>()
      const assignedColors = new Set<string>()

      // First pass: exact matches with previous slots
      for (let slot = 0; slot < rasterSlotEnd; slot++) {
        const prevKey = colorKey(previousRasterSlots[slot])
        for (const rasterColor of rasterColors) {
          const rasterKey = colorKey(rasterColor)
          if (rasterKey === prevKey && !assignedColors.has(rasterKey)) {
            newPalette[slot] = rasterColor
            assignedSlots.add(slot)
            assignedColors.add(rasterKey)
            break
          }
        }
      }

      // Second pass: assign remaining colors to unused slots
      for (const rasterColor of rasterColors) {
        const rasterKey = colorKey(rasterColor)
        if (assignedColors.has(rasterKey)) continue

        for (let slot = 0; slot < rasterSlotEnd; slot++) {
          if (!assignedSlots.has(slot)) {
            newPalette[slot] = rasterColor
            assignedSlots.add(slot)
            assignedColors.add(rasterKey)
            break
          }
        }
      }
    } else {
      // STANDARD MODE: Use existing logic
      // Select best colors for this line, constrained to drift from base palette
      const lineColors = selectBestColorsForLine(
        colorFrequencies,
        currentPalette,
        basePalette, // Pass global palette as anchor for drift constraints
        nColors,
        cpcClassicPalette
      )

      // Quantize line colors to hardware color format
      const quantizedLineColors = lineColors.map((c) => quantizeColor(c))

      // Assign colors to ink indices, minimizing changes from previous line
      newPalette = assignColorsToInks(quantizedLineColors, currentPalette)
    }

    // Collect all potential changes for this line
    const lineChanges: Array<{
      inkIndex: number
      prevColor: Vector<'RGB'>
      newColor: Vector<'RGB'>
      impact: number
    }> = []

    // IMPORTANT: Only iterate over modifiable indices
    // Mode 0 CPC Plus: only indices 0-3 can change (rasterSlotStart to rasterSlotEnd)
    // Other modes: all indices can change
    for (let inkIndex = rasterSlotStart; inkIndex < rasterSlotEnd; inkIndex++) {
      const prevColor = currentPalette[inkIndex]
      const newColor = newPalette[inkIndex]

      // Skip if there's already an existing change at this line for this ink
      if (existingChangeSet.has(`${line}-${inkIndex}`)) continue

      // Check if color changed
      if (!colorsEqual(prevColor, newColor)) {
        // Calculate impact: how many pixels on this line use this ink
        // and how much the color differs
        const colorDiff = weightedRGBDistance(prevColor, newColor)
        // Count pixels that would benefit from this change
        // Use analysisData to measure impact based on original source colors
        let pixelCount = 0
        const lineStart = line * width
        for (let x = 0; x < width; x++) {
          const pixelIdx = (lineStart + x) * 4
          const pixelColor: Vector<'RGB'> = [
            data[pixelIdx],
            data[pixelIdx + 1],
            data[pixelIdx + 2]
          ]
          const quantizedPixel = quantizeColor(pixelColor)
          // Check if this pixel is closer to the new color than the old
          const distToNew = weightedRGBDistance(quantizedPixel, newColor)
          const distToOld = weightedRGBDistance(quantizedPixel, prevColor)
          if (distToNew < distToOld) {
            pixelCount++
          }
        }
        lineChanges.push({
          inkIndex,
          prevColor,
          newColor,
          impact: pixelCount * colorDiff
        })
      }
    }

    // Apply maxChangesPerLine constraint: keep only the most impactful changes
    if (lineChanges.length > maxChangesPerLine) {
      // Sort by impact (descending) and keep only top N
      lineChanges.sort((a, b) => b.impact - a.impact)
      lineChanges.length = maxChangesPerLine

      // Rebuild newPalette with only the selected changes
      newPalette = [...currentPalette]
      for (const change of lineChanges) {
        newPalette[change.inkIndex] = change.newColor
      }
    }

    // Add the selected changes
    for (const change of lineChanges) {
      changes.push({
        line,
        inkIndex: change.inkIndex,
        color: change.newColor
      })
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
      const quantizedPixel = quantizeColor(pixelColor)
      const key = colorKey(quantizedPixel)

      // Find the ink index for this color
      let inkIndex = colorToInk.get(key)

      // If color not in palette (was not frequent enough), find closest color
      inkIndex ??= findClosestColorIndex(
        quantizedPixel,
        newPalette,
        weightedRGBDistance
      )

      indexBuffer[lineStart + x] = inkIndex
    }

    // Update current palette for next line
    currentPalette = newPalette
  }

  // Combine with existing changes
  const allChanges = [...existingChanges, ...changes]

  // Return the extracted palette as the quantized global palette
  // (needed for the renderer to start with the correct palette)
  const quantizedGlobal = [...basePalette]
  while (quantizedGlobal.length < 4) {
    quantizedGlobal.push([0, 0, 0])
  }

  // Sort by line
  const sortedChanges = allChanges.slice().sort((a, b) => a.line - b.line)
  return {
    changes: sortedChanges,
    indexBuffer,
    quantizedGlobalPalette: quantizedGlobal
  }
}

// ============================================================================
// NEW RASTER PIPELINE based on raster-ideas.md
// ============================================================================

/**
 * Add color and error, clamping only the final result to valid RGB range
 */
function addColors(
  color: Vector<'RGB'>,
  error: [number, number, number]
): Vector<'RGB'> {
  return [
    Math.max(0, Math.min(255, color[0] + error[0])),
    Math.max(0, Math.min(255, color[1] + error[1])),
    Math.max(0, Math.min(255, color[2] + error[2]))
  ]
}

/**
 * Scale an error vector
 */
function scaleError(
  e: [number, number, number],
  factor: number
): [number, number, number] {
  return [e[0] * factor, e[1] * factor, e[2] * factor]
}

/**
 * Select palette using "Farthest Point Sampling" algorithm.
 * This maximizes the distance between chosen colors, preserving extremes.
 *
 * Algorithm from raster-ideas.md §5.1.1:
 * 1. Start with the most frequent color
 * 2. Add colors that maximize minimum distance to already-selected colors
 *
 * @param colorFrequencies - Map of colors to their frequencies
 * @param maxColors - Maximum colors to select (4)
 * @param previousPalette - Previous line's palette for continuity bonus
 * @returns Selected colors
 */
function selectPaletteFarthestPoint(
  colorFrequencies: Map<string, { color: Vector<'RGB'>; count: number }>,
  maxColors: number,
  previousPalette: Vector<'RGB'>[] | null = null
): Vector<'RGB'>[] {
  // Use preprocessing parameters for base palette extraction
  const continuityDistance = rasterTuningOverrides.preprocessContinuityDistance
  const continuityBonusValue = rasterTuningOverrides.preprocessContinuityBonus
  const frequencyExponent = rasterTuningOverrides.preprocessFrequencyExponent

  const colors = Array.from(colorFrequencies.values())

  if (colors.length === 0) {
    return previousPalette
      ? [...previousPalette]
      : [
          [0, 0, 0],
          [85, 85, 85],
          [170, 170, 170],
          [255, 255, 255]
        ]
  }

  if (colors.length <= maxColors) {
    return colors.map((c) => c.color)
  }

  // Sort by frequency
  colors.sort((a, b) => b.count - a.count)

  const palette: Vector<'RGB'>[] = []
  const usedKeys = new Set<string>()

  // Start with the most frequent color
  const first = colors[0]
  palette.push(first.color)
  usedKeys.add(colorKey(first.color))

  // Add remaining colors using farthest point sampling
  while (palette.length < maxColors && colors.length > palette.length) {
    let bestColor: Vector<'RGB'> | null = null
    let bestScore = -1

    for (const { color, count } of colors) {
      const key = colorKey(color)
      if (usedKeys.has(key)) continue

      // Calculate minimum distance to all already-selected colors
      let minDist = Number.POSITIVE_INFINITY
      for (const palColor of palette) {
        const dist = weightedRGBDistance(color, palColor)
        if (dist < minDist) {
          minDist = dist
        }
      }

      // Score = distance * (frequency ^ exponent) to balance distance and importance
      // High frequency colors that are far from selected colors are preferred
      // Exponent controls frequency influence: 0.5 = sqrt (balanced), 1.0 = linear (strong)
      const frequencyWeight = count ** frequencyExponent
      const score = minDist * frequencyWeight

      // Bonus for colors similar to previous palette (continuity)
      let continuityBonusFactor = 1
      if (previousPalette) {
        for (const prevColor of previousPalette) {
          const dist = weightedRGBDistance(color, prevColor)
          if (dist < continuityDistance) {
            continuityBonusFactor = continuityBonusValue
            break
          }
        }
      }

      const finalScore = score * continuityBonusFactor

      if (finalScore > bestScore) {
        bestScore = finalScore
        bestColor = color
      }
    }

    if (!bestColor) break

    palette.push(bestColor)
    usedKeys.add(colorKey(bestColor))
  }

  return palette
}

/**
 * Options for raster preprocessing
 */
export interface RasterPreprocessOptions {
  /**
   * Dithering intensity from 0 (no dithering) to 1 (full dithering)
   *
   * ANTI-BANDING: Lower values (0.5-0.6) can help reduce banding by creating
   * cleaner color boundaries that the optimizer can work with better.
   * Higher values (0.7-0.9) add texture but may create noise.
   *
   * Default: 0.75 (reduced to minimize noise while maintaining quality)
   */
  ditheringIntensity?: number
  /**
   * Number of colors per line for the current CPC mode.
   * Mode 0: 16 colors, Mode 1: 4 colors, Mode 2: 2 colors.
   * Default: 4 (Mode 1)
   */
  nColors?: number
  /**
   * CPC Classic hardware palette (27 colors).
   * When provided, colors are constrained to this fixed palette instead of
   * using CPC Plus 4096-color quantization.
   */
  cpcClassicPalette?: Vector<'RGB'>[]
}

/**
 * Pre-process an image using the improved raster pipeline from raster-ideas.md.
 *
 * This implements:
 * 1. Farthest point sampling for palette selection (§5.1.1)
 * 2. Horizontal 1D dithering with Floyd-Steinberg (§5.2)
 * 3. Vertical error compensation between lines (§5.3)
 * 4. Palette continuity penalty (§5.1.2)
 *
 * @param sourceImage - Original image data
 * @param _globalPalette - IGNORED - kept for API compatibility
 * @param options - Optional preprocessing options
 * @returns Pre-processed ImageData with max 4 colors per line
 */
export function preprocessImageForRaster(
  sourceImage: ImageData,
  _globalPalette: Vector<'RGB'>[],
  options: RasterPreprocessOptions = {}
): ImageData {
  let { ditheringIntensity = 0.75, nColors = 4, cpcClassicPalette } = options
  // Clamp dithering intensity to a maximum of 1.0 (full effect allowed)
  ditheringIntensity = Math.min(ditheringIntensity, 1)
  const { width, height, data } = sourceImage
  const outputData = new Uint8ClampedArray(data.length)
  if (cpcClassicPalette) {
    if (!cpcClassicLUT || cpcClassicLUTPalette !== cpcClassicPalette) {
      cpcClassicLUT = buildCPCClassicLUT(cpcClassicPalette)
      cpcClassicLUTPalette = cpcClassicPalette
    }
  }

  // Helper function to quantize a color based on hardware mode
  // CPC Classic: use pre-computed LUT (ultra-fast array lookup)
  // CPC Plus: quantize to 4096 colors (4 bits per channel)
  const quantizeColor = (color: Vector<'RGB'>): Vector<'RGB'> => {
    if (cpcClassicPalette && cpcClassicLUT) {
      return quantizeToCPCClassicWithLUT(
        color,
        cpcClassicPalette,
        cpcClassicLUT
      )
    }
    return quantizeToCPCPlus(color)
  }

  // Extract initial global palette from the source image
  // Use nColors from the current mode (Mode 0: 16, Mode 1: 4, Mode 2: 2)
  const extractedPalette = extractGlobalPaletteFromImage(
    sourceImage,
    nColors,
    cpcClassicPalette
  )
  while (extractedPalette.length < nColors) {
    extractedPalette.push([0, 0, 0])
  }

  // Vertical error buffer: stores error to propagate to next line
  // Each entry is [errR, errG, errB] for each x position (floating-point for precision)
  let verticalError: [number, number, number][] = new Array(width)
    .fill(null)
    .map(() => [0, 0, 0])

  // Previous line's palette for continuity
  let previousPalette: Vector<'RGB'>[] = extractedPalette

  // Process each line
  for (let line = 0; line < height; line++) {
    const lineStart = line * width * 4

    // Step 1: Build color histogram for this line, incorporating vertical error
    const colorHistogram = new Map<
      string,
      { color: Vector<'RGB'>; count: number }
    >()

    for (let x = 0; x < width; x++) {
      const pixelIdx = lineStart + x * 4
      const sourceColor: Vector<'RGB'> = [
        data[pixelIdx],
        data[pixelIdx + 1],
        data[pixelIdx + 2]
      ]

      // Apply vertical error correction
      const correctedColor = addColors(sourceColor, verticalError[x])
      const quantized = quantizeColor(correctedColor)
      const key = colorKey(quantized)

      const existing = colorHistogram.get(key)
      if (existing) {
        existing.count++
      } else {
        colorHistogram.set(key, { color: quantized, count: 1 })
      }
    }

    // Step 2: Select palette using farthest point sampling
    // Limited to nColors for the current mode (Mode 2 = 2, Mode 1 = 4, Mode 0 = 16)
    const linePalette = selectPaletteFarthestPoint(
      colorHistogram,
      nColors,
      previousPalette
    )

    // Ensure nColors colors
    while (linePalette.length < nColors) {
      for (const pc of previousPalette) {
        if (linePalette.length >= nColors) break
        const key = colorKey(pc)
        if (!linePalette.some((c) => colorKey(c) === key)) {
          linePalette.push(pc)
        }
      }
      if (linePalette.length < nColors) {
        linePalette.push([0, 0, 0])
      }
    }

    // Quantize palette to hardware color space
    const quantizedPalette = linePalette.map((c) => quantizeColor(c))

    // Check if this line already satisfies the nColors constraint
    // If so, always skip dithering to preserve the original colors (even if intensity > 0)
    // This prevents adding noise to already clean lines
    const lineAlreadySatisfiesConstraint = colorHistogram.size <= nColors

    // New vertical error buffer for next line (floating-point)
    const newVerticalError: [number, number, number][] = new Array(width)
      .fill(null)
      .map(() => [0, 0, 0])

    if (lineAlreadySatisfiesConstraint) {
      // Line already has ≤nColors colors: direct mapping without dithering
      for (let x = 0; x < width; x++) {
        const pixelIdx = lineStart + x * 4
        const sourceColor: Vector<'RGB'> = [
          data[pixelIdx],
          data[pixelIdx + 1],
          data[pixelIdx + 2]
        ]

        // Quantize and find exact match in palette
        const quantizedSource = quantizeColor(sourceColor)
        const closestIdx = findClosestColorIndex(
          quantizedSource,
          quantizedPalette,
          weightedRGBDistance
        )
        const chosenColor = quantizedPalette[closestIdx]

        // Write output pixel (no error propagation)
        outputData[pixelIdx] = chosenColor[0]
        outputData[pixelIdx + 1] = chosenColor[1]
        outputData[pixelIdx + 2] = chosenColor[2]
        outputData[pixelIdx + 3] = 255
      }

      // Reset vertical error for next line (no error to propagate)
      // Keep it at zero
    } else {
      // Line has >4 colors: apply dithering
      // Horizontal error buffer for this line (floating-point)
      const horizError: [number, number, number][] = new Array(width)
        .fill(null)
        .map(() => [0, 0, 0])

      for (let x = 0; x < width; x++) {
        const pixelIdx = lineStart + x * 4
        const sourceColor: Vector<'RGB'> = [
          data[pixelIdx],
          data[pixelIdx + 1],
          data[pixelIdx + 2]
        ]

        // Apply accumulated error (vertical from previous line + horizontal from left)
        const rawTotalError = addErrors(verticalError[x], horizError[x])

        // Clamp accumulated error to prevent runaway values
        // Scale the clamp with dithering intensity to prevent dark artifacts
        // At intensity=1.0: ±64, at intensity=0.5: ±32, etc.
        // Lower values prevent the dithering from pushing pixels too far from original
        const maxAccumulatedError = 64 * ditheringIntensity
        const totalError: [number, number, number] = [
          Math.max(
            -maxAccumulatedError,
            Math.min(maxAccumulatedError, rawTotalError[0])
          ),
          Math.max(
            -maxAccumulatedError,
            Math.min(maxAccumulatedError, rawTotalError[1])
          ),
          Math.max(
            -maxAccumulatedError,
            Math.min(maxAccumulatedError, rawTotalError[2])
          )
        ]

        // Add error to source color (may go out of [0,255] range temporarily)
        const targetR = sourceColor[0] + totalError[0]
        const targetG = sourceColor[1] + totalError[1]
        const targetB = sourceColor[2] + totalError[2]

        // Clamp to valid RGB range for palette lookup
        const correctedColor: Vector<'RGB'> = [
          Math.max(0, Math.min(255, targetR)),
          Math.max(0, Math.min(255, targetG)),
          Math.max(0, Math.min(255, targetB))
        ]

        // Find closest palette color
        const closestIdx = findClosestColorIndex(
          correctedColor,
          quantizedPalette,
          weightedRGBDistance
        )
        const chosenColor = quantizedPalette[closestIdx]

        // Calculate quantization error based on UNCLAMPED target color
        // This is key: if we wanted targetR=-100 but clamped to 0, and chose color 0,
        // the error is 0-(-100)=100, not 0-0=0
        const rawError: [number, number, number] = [
          targetR - chosenColor[0],
          targetG - chosenColor[1],
          targetB - chosenColor[2]
        ]

        // Clamp the error before propagation to prevent runaway accumulation
        // Use a dynamic threshold based on dithering intensity
        // At intensity=1: ±32, at intensity=0.5: ±16, etc.
        const maxError = 32 * ditheringIntensity
        const error: [number, number, number] = [
          Math.max(-maxError, Math.min(maxError, rawError[0])),
          Math.max(-maxError, Math.min(maxError, rawError[1])),
          Math.max(-maxError, Math.min(maxError, rawError[2]))
        ]

        // Distribute error with configurable intensity
        // Base coefficients from raster-constants.ts
        // Horizontal: 1/2, Vertical: 1/8 (reduced to minimize vertical banding)
        // At intensity=0: no error propagation
        // Use configurable error propagation coefficients (defaults: horiz 0.55, vert 0.13)
        const horizCoef =
          (rasterTuningOverrides.horizontalErrorCoefficient ?? 0.55) *
          ditheringIntensity
        const vertCoef =
          (rasterTuningOverrides.verticalErrorCoefficient ?? 0.13) *
          ditheringIntensity

        // Horizontal error propagation
        if (x + 1 < width && horizCoef > 0) {
          const he = scaleError(error, horizCoef)
          horizError[x + 1] = addErrors(horizError[x + 1], he)
        }

        // Vertical error propagation - simplified to just below pixel
        if (vertCoef > 0) {
          const ve = scaleError(error, vertCoef)
          newVerticalError[x] = addErrors(newVerticalError[x], ve)
        }

        // Write output pixel
        outputData[pixelIdx] = chosenColor[0]
        outputData[pixelIdx + 1] = chosenColor[1]
        outputData[pixelIdx + 2] = chosenColor[2]
        outputData[pixelIdx + 3] = 255
      }
    }

    // Update for next line
    verticalError = newVerticalError
    previousPalette = quantizedPalette
  }

  return new ImageData(outputData, width, height)
}
