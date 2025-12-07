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
 * Calculate squared Euclidean distance between two colors
 */
function colorDistanceSquared(a: Vector<'RGB'>, b: Vector<'RGB'>): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

/**
 * Find the index of the closest color in the palette to the given color
 */
function findClosestColorIndex(
  color: Vector<'RGB'>,
  palette: Vector<'RGB'>[]
): number {
  let bestIndex = 0
  let bestDistance = colorDistanceSquared(color, palette[0])

  for (let i = 1; i < palette.length; i++) {
    const distance = colorDistanceSquared(color, palette[i])
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = i
    }
  }

  return bestIndex
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
  maxColors: number = 4
): Vector<'RGB'>[] {
  const { width, height, data } = sourceImage

  // Build histogram of all colors in the image
  const colorFrequency = new Map<
    string,
    { color: Vector<'RGB'>; count: number }
  >()

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const color: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]
      // Quantize immediately to CPC Plus to reduce unique colors
      const quantized = quantizeToCPCPlus(color)
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

  // Use median cut to select the best colors
  const pixels: WeightedPixel[] = Array.from(colorFrequency.values()).map(
    ({ color, count }) => ({ color, weight: count })
  )

  return medianCut(pixels, maxColors)
}

/**
 * Threshold for considering two colors as belonging to the same "family".
 * Colors within this distance are considered similar enough that we should
 * keep the same CPC color to avoid banding.
 *
 * This is ~30 units per channel = 30*30*3 = 2700
 * In source images, subtle gradients often have colors within this range.
 */
const COLOR_FAMILY_THRESHOLD = 30 * 30 * 3

/**
 * Select the best colors for a line with color family stabilization.
 *
 * The key insight: source images often have subtle gradients where colors
 * differ by only a few RGB values per line. When quantized to CPC Plus,
 * these tiny differences can map to DIFFERENT CPC colors, causing visible banding.
 *
 * Solution: For each ink slot, if the dominant source color on this line
 * is "in the same family" as what the current palette color represents,
 * we KEEP the current CPC color rather than switching to a slightly different one.
 *
 * @param colorFrequencies - Map of color frequencies for this line
 * @param currentPalette - The current palette (from previous line)
 * @param basePalette - The original global palette (anchor point)
 * @param maxColors - Maximum colors to select (default 4)
 * @returns Selected colors for this line
 */
function selectBestColorsForLine(
  colorFrequencies: Map<string, { color: Vector<'RGB'>; count: number }>,
  currentPalette: Vector<'RGB'>[],
  _basePalette: Vector<'RGB'>[] | null = null,
  maxColors: number = 4
): Vector<'RGB'>[] {
  // If we have ≤maxColors unique colors, return all of them
  if (colorFrequencies.size <= maxColors) {
    return Array.from(colorFrequencies.values()).map((v) => v.color)
  }

  // Quantize current palette
  const quantizedCurrent = currentPalette.map((c) => quantizeToCPCPlus(c))

  // Collect all line colors with their frequencies (NOT quantized yet)
  const lineColors = Array.from(colorFrequencies.entries())
    .map(([, { color, count }]) => ({ color, count }))
    .sort((a, b) => b.count - a.count)

  // Calculate total pixels
  const totalPixels = lineColors.reduce((sum, { count }) => sum + count, 0)

  // For each current palette color, find how many line pixels it "represents"
  // A palette color represents a line pixel if that pixel's color is within
  // COLOR_FAMILY_THRESHOLD of the palette color (before CPC quantization)
  const paletteRepresentation: {
    palIndex: number
    coverage: number
    avgSourceColor: Vector<'RGB'>
  }[] = []

  for (let palIndex = 0; palIndex < quantizedCurrent.length; palIndex++) {
    const palColor = quantizedCurrent[palIndex]
    let coverage = 0
    let sumR = 0,
      sumG = 0,
      sumB = 0,
      sumWeight = 0

    for (const { color, count } of lineColors) {
      // Compare source color to palette color
      const dist = colorDistanceSquared(color, palColor)
      if (dist <= COLOR_FAMILY_THRESHOLD) {
        coverage += count
        sumR += color[0] * count
        sumG += color[1] * count
        sumB += color[2] * count
        sumWeight += count
      }
    }

    const avgSourceColor: Vector<'RGB'> =
      sumWeight > 0
        ? [
            Math.round(sumR / sumWeight),
            Math.round(sumG / sumWeight),
            Math.round(sumB / sumWeight)
          ]
        : palColor

    paletteRepresentation.push({ palIndex, coverage, avgSourceColor })
  }

  // Sort by coverage (most representative first)
  paletteRepresentation.sort((a, b) => b.coverage - a.coverage)

  // Calculate total coverage by current palette
  const totalCoverage = paletteRepresentation.reduce(
    (sum, p) => sum + p.coverage,
    0
  )
  const coverageRatio = totalCoverage / totalPixels

  // Build new palette
  const newPalette: Vector<'RGB'>[] = [...quantizedCurrent]
  const coveredPixels = new Set<string>()

  // If current palette covers well (>70%), keep it entirely for stability
  if (coverageRatio >= 0.7) {
    return newPalette
  }

  // If coverage is moderate (40-70%), keep the well-representing colors
  // but replace poorly-representing ones
  if (coverageRatio >= 0.4) {
    // Mark which line colors are covered by good palette entries
    for (const rep of paletteRepresentation) {
      if (rep.coverage > totalPixels * 0.1) {
        // This palette entry is useful, keep it
        for (const { color } of lineColors) {
          const dist = colorDistanceSquared(
            color,
            quantizedCurrent[rep.palIndex]
          )
          if (dist <= COLOR_FAMILY_THRESHOLD) {
            coveredPixels.add(colorKey(color))
          }
        }
      }
    }

    // Find uncovered line colors
    const uncoveredColors = lineColors.filter(
      ({ color }) => !coveredPixels.has(colorKey(color))
    )

    if (uncoveredColors.length > 0) {
      // Find palette slots with poor coverage to replace
      const poorSlots = paletteRepresentation
        .filter((rep) => rep.coverage < totalPixels * 0.05)
        .map((rep) => rep.palIndex)

      // Replace poor slots with best uncovered colors
      let slotIndex = 0
      for (const { color } of uncoveredColors) {
        if (slotIndex >= poorSlots.length) break
        newPalette[poorSlots[slotIndex]] = quantizeToCPCPlus(color)
        slotIndex++
      }
    }

    return newPalette
  }

  // Poor coverage (<40%): need to select colors based on line content
  // Use median cut on the most frequent line colors
  const pixels: WeightedPixel[] = lineColors.map(({ color, count }) => ({
    color: quantizeToCPCPlus(color),
    weight: count
  }))

  const selectedColors = medianCut(pixels, maxColors)

  // Try to match selected colors to existing palette slots for stability
  const usedSlots = new Set<number>()
  const result: Vector<'RGB'>[] = [...quantizedCurrent]

  for (const selectedColor of selectedColors) {
    // Find the best matching slot (closest current color)
    let bestSlot = -1
    let bestDist = Number.POSITIVE_INFINITY

    for (let i = 0; i < result.length; i++) {
      if (usedSlots.has(i)) continue
      const dist = colorDistanceSquared(selectedColor, result[i])
      if (dist < bestDist) {
        bestDist = dist
        bestSlot = i
      }
    }

    if (bestSlot >= 0) {
      // Only replace if the new color is significantly different
      // This prevents oscillation between very similar CPC colors
      if (bestDist > 17 * 17 * 3) {
        // More than 1 CPC step difference
        result[bestSlot] = selectedColor
      }
      usedSlots.add(bestSlot)
    }
  }

  return result
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
  _globalPalette: Vector<'RGB'>[],
  existingChanges: Omit<RasterChange, 'id'>[] = []
): OptimizationResult {
  const { width, height: imageHeight, data } = sourceImage
  const changes: Omit<RasterChange, 'id'>[] = []
  const indexBuffer = new Uint8Array(width * imageHeight)

  // Create a set of existing changes for fast lookup
  const existingChangeSet = new Set(
    existingChanges.map((c) => `${c.line}-${c.inkIndex}`)
  )

  // CRITICAL FIX: Extract palette from the SOURCE IMAGE, not from external palette
  // This prevents colors that don't exist in the image (like turquoise green) from being used
  const extractedPalette = extractGlobalPaletteFromImage(sourceImage, 4)

  // Initialize with extracted palette
  const basePalette = [...extractedPalette]

  // Pad to 4 colors if needed
  while (basePalette.length < 4) {
    basePalette.push([0, 0, 0])
  }

  const numInks = 4

  // Current palette starts from base and evolves line by line
  let currentPalette = [...basePalette]

  // Process each line
  for (let line = 0; line < imageHeight; line++) {
    // Extract color frequencies from this line
    const colorFrequencies = extractLineColorFrequencies(sourceImage, line)

    // Select best colors for this line, constrained to drift from base palette
    const lineColors = selectBestColorsForLine(
      colorFrequencies,
      currentPalette,
      basePalette, // Pass global palette as anchor for drift constraints
      4
    )

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
      let inkIndex = colorToInk.get(key)

      // If color not in palette (was not frequent enough), find closest color
      if (inkIndex === undefined) {
        inkIndex = findClosestColorIndex(quantizedPixel, newPalette)
      }

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
  return {
    changes: allChanges.sort((a, b) => a.line - b.line),
    indexBuffer,
    quantizedGlobalPalette: quantizedGlobal
  }
}

// ============================================================================
// NEW RASTER PIPELINE based on raster-ideas.md
// ============================================================================

/**
 * Add two colors (with clamping)
 */
function addColors(
  a: Vector<'RGB'>,
  b: [number, number, number]
): Vector<'RGB'> {
  return [
    Math.max(0, Math.min(255, a[0] + b[0])),
    Math.max(0, Math.min(255, a[1] + b[1])),
    Math.max(0, Math.min(255, a[2] + b[2]))
  ]
}

/**
 * Subtract two colors (for error calculation)
 */
function subtractColors(
  a: Vector<'RGB'>,
  b: Vector<'RGB'>
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
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
        const dist = colorDistanceSquared(color, palColor)
        if (dist < minDist) {
          minDist = dist
        }
      }

      // Score = distance * sqrt(frequency) to balance distance and importance
      // High frequency colors that are far from selected colors are preferred
      const score = minDist * Math.sqrt(count)

      // Bonus for colors similar to previous palette (continuity)
      let continuityBonus = 1.0
      if (previousPalette) {
        for (const prevColor of previousPalette) {
          const dist = colorDistanceSquared(color, prevColor)
          if (dist < 17 * 17 * 3) {
            // Within 1 CPC step
            continuityBonus = 1.5 // 50% bonus
            break
          }
        }
      }

      const finalScore = score * continuityBonus

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
 * @returns Pre-processed ImageData with max 4 colors per line
 */
export function preprocessImageForRaster(
  sourceImage: ImageData,
  _globalPalette: Vector<'RGB'>[]
): ImageData {
  const { width, height, data } = sourceImage
  const outputData = new Uint8ClampedArray(data.length)

  // Extract initial global palette from the source image
  const extractedPalette = extractGlobalPaletteFromImage(sourceImage, 4)
  while (extractedPalette.length < 4) {
    extractedPalette.push([0, 0, 0])
  }

  // Vertical error buffer: stores error to propagate to next line
  // Each entry is [errR, errG, errB] for each x position
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
      const quantized = quantizeToCPCPlus(correctedColor)
      const key = colorKey(quantized)

      const existing = colorHistogram.get(key)
      if (existing) {
        existing.count++
      } else {
        colorHistogram.set(key, { color: quantized, count: 1 })
      }
    }

    // Step 2: Select palette using farthest point sampling
    const linePalette = selectPaletteFarthestPoint(
      colorHistogram,
      4,
      previousPalette
    )

    // Ensure 4 colors
    while (linePalette.length < 4) {
      for (const pc of previousPalette) {
        if (linePalette.length >= 4) break
        const key = colorKey(pc)
        if (!linePalette.some((c) => colorKey(c) === key)) {
          linePalette.push(pc)
        }
      }
      if (linePalette.length < 4) {
        linePalette.push([0, 0, 0])
      }
    }

    // Quantize palette to CPC Plus
    const quantizedPalette = linePalette.map((c) => quantizeToCPCPlus(c))

    // Check if this line already satisfies the 4-color constraint
    // If so, skip dithering to preserve the original colors
    const lineAlreadySatisfiesConstraint = colorHistogram.size <= 4

    // New vertical error buffer for next line
    const newVerticalError: [number, number, number][] = new Array(width)
      .fill(null)
      .map(() => [0, 0, 0])

    if (lineAlreadySatisfiesConstraint) {
      // Line already has ≤4 colors: direct mapping without dithering
      for (let x = 0; x < width; x++) {
        const pixelIdx = lineStart + x * 4
        const sourceColor: Vector<'RGB'> = [
          data[pixelIdx],
          data[pixelIdx + 1],
          data[pixelIdx + 2]
        ]

        // Quantize and find exact match in palette
        const quantizedSource = quantizeToCPCPlus(sourceColor)
        const closestIdx = findClosestColorIndex(
          quantizedSource,
          quantizedPalette
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
      // Horizontal error buffer for this line
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
        const correctedColor = addColors(
          addColors(sourceColor, verticalError[x]),
          horizError[x]
        )

        // Find closest palette color
        const closestIdx = findClosestColorIndex(
          correctedColor,
          quantizedPalette
        )
        const chosenColor = quantizedPalette[closestIdx]

        // Calculate quantization error
        const error = subtractColors(correctedColor, chosenColor)

        // Distribute error using modified Floyd-Steinberg for 1D + vertical
        // Horizontal: 7/16 to right pixel
        // Vertical: 5/16 to pixel below, 3/16 to below-left, 1/16 to below-right

        // Horizontal error propagation (7/16 ≈ 0.4375)
        if (x + 1 < width) {
          const he = scaleError(error, 7 / 16)
          horizError[x + 1][0] += he[0]
          horizError[x + 1][1] += he[1]
          horizError[x + 1][2] += he[2]
        }

        // Vertical error propagation for next line
        // Below-left (3/16)
        if (x > 0) {
          const ve = scaleError(error, 3 / 16)
          newVerticalError[x - 1][0] += ve[0]
          newVerticalError[x - 1][1] += ve[1]
          newVerticalError[x - 1][2] += ve[2]
        }

        // Directly below (5/16)
        {
          const ve = scaleError(error, 5 / 16)
          newVerticalError[x][0] += ve[0]
          newVerticalError[x][1] += ve[1]
          newVerticalError[x][2] += ve[2]
        }

        // Below-right (1/16)
        if (x + 1 < width) {
          const ve = scaleError(error, 1 / 16)
          newVerticalError[x + 1][0] += ve[0]
          newVerticalError[x + 1][1] += ve[1]
          newVerticalError[x + 1][2] += ve[2]
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
