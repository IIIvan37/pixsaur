/**
 * Line Palette Optimization
 *
 * Main optimization function for raster mode images.
 * Assigns colors to ink indices and generates raster changes.
 */

import { weightedRGBDistance } from '../pixsaur-color/src/metric/distance'
import { findClosestColorIndex } from '../pixsaur-color/src/metric/find-closest'
import type { Vector } from '../pixsaur-color/src/type'
import {
  createQuantizeFunction,
  getCPCClassicLUT,
  needsLUTRebuild
} from './color-quantization'
import { assignColorsToInks, colorKey, colorsEqual } from './ink-assignment'
import type { WeightedPixel } from './median-cut'
import { medianCut } from './median-cut'
import {
  extractLineColorFrequencies,
  selectBestColorsForLine,
  selectPaletteFarthestPoint
} from './palette-selection'
import type { RasterChange } from './types'

// ============================================================================
// Mode 0 CPC Plus Constants
// ============================================================================

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

// ============================================================================
// Global Palette Extraction
// ============================================================================

/**
 * Extract the best global palette from the source image.
 * This analyzes the ENTIRE image and selects the most representative colors.
 *
 * @param sourceImage - The source image to analyze
 * @param maxColors - Maximum colors to extract (default 4)
 * @param cpcClassicPalette - CPC Classic palette for quantization
 * @returns Array of representative colors, quantized to hardware
 */
export function extractGlobalPaletteFromImage(
  sourceImage: ImageData,
  maxColors: number = 4,
  cpcClassicPalette?: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  const { width, height, data } = sourceImage

  // Get LUT for CPC Classic if needed
  const lut = cpcClassicPalette ? getCPCClassicLUT(cpcClassicPalette) : null
  const quantize = createQuantizeFunction(cpcClassicPalette, lut)

  // Build histogram of all colors in the image
  const colorFrequency = new Map<
    string,
    { color: Vector<'RGB'>; count: number }
  >()

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const color: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]
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
  return selectPaletteFarthestPoint(colorFrequency, maxColors, null)
}

/**
 * Extract global colors for Mode 0 CPC Plus raster optimization.
 * Uses a "globalScore" that favors colors appearing on many lines.
 */
function extractGlobalColorsForMode0Plus(
  sourceImage: ImageData,
  cpcClassicPalette?: Vector<'RGB'>[],
  numFixedColors: number = MODE_0_FIXED_COLORS
): Vector<'RGB'>[] {
  const { width, height, data } = sourceImage

  // Get LUT for CPC Classic if needed
  const lut = cpcClassicPalette ? getCPCClassicLUT(cpcClassicPalette) : null
  const quantize = createQuantizeFunction(cpcClassicPalette, lut)

  // Track color statistics: pixelCount AND lineCount
  const colorStats = new Map<
    string,
    {
      color: Vector<'RGB'>
      pixelCount: number
      lines: Set<number>
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
  const W1 = 1 // Pixel frequency weight
  const W2 = 2 // Line coverage weight

  const colorScores = Array.from(colorStats.values())
    .map((stats) => ({
      color: stats.color,
      pixelCount: stats.pixelCount,
      lineCount: stats.lines.size,
      globalScore: W1 * stats.pixelCount + W2 * stats.lines.size * (width / 4)
    }))
    .sort((a, b) => b.globalScore - a.globalScore)

  if (colorScores.length <= numFixedColors) {
    return colorScores.map((c) => c.color)
  }

  // Use median cut to reduce to numFixedColors
  const topCandidates = colorScores.slice(0, numFixedColors * 2)
  const pixels: WeightedPixel[] = topCandidates.map((c) => ({
    color: c.color,
    weight: c.globalScore
  }))

  return medianCut(pixels, numFixedColors)
}

// ============================================================================
// Optimization Result Types
// ============================================================================

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
  /** Number of colors per line for the current CPC mode */
  nColors?: number
  /** CPC Classic hardware palette (27 colors) */
  cpcClassicPalette?: Vector<'RGB'>[]
  /** Use the provided global palette instead of extracting it from the image */
  useProvidedPalette?: boolean
}

// ============================================================================
// Main Optimization Function
// ============================================================================

/**
 * Main optimization function for images that already respect the 4-colors-per-line constraint.
 *
 * This algorithm:
 * 1. For each line, extracts the unique colors present (max 4)
 * 2. Assigns these colors to ink indices, trying to minimize changes from previous line
 * 3. Generates raster changes where ink colors differ from the previous line
 * 4. Creates an index buffer where each pixel maps to its ink index
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

  // Build LUT for CPC Classic if needed
  if (cpcClassicPalette && needsLUTRebuild(cpcClassicPalette)) {
    getCPCClassicLUT(cpcClassicPalette)
  }

  const lut = cpcClassicPalette ? getCPCClassicLUT(cpcClassicPalette) : null
  const quantizeColor = createQuantizeFunction(cpcClassicPalette, lut)

  // Create a set of existing changes for fast lookup
  const existingChangeSet = new Set(
    existingChanges.map((c) => `${c.line}-${c.inkIndex}`)
  )

  // Detect Mode 0 CPC Plus for special raster handling
  const isMode0Plus = isMode0CPCPlus(nColors, cpcClassicPalette)

  // Determine base palette and raster slot ranges
  let basePalette: Vector<'RGB'>[]
  let rasterSlotStart: number
  let rasterSlotEnd: number

  if (isMode0Plus) {
    const result = setupMode0PlusPalette(
      preprocessedImage,
      globalPalette,
      maxChangesPerLine,
      cpcClassicPalette,
      useProvidedPalette,
      quantizeColor
    )
    basePalette = result.basePalette
    rasterSlotStart = result.rasterSlotStart
    rasterSlotEnd = result.rasterSlotEnd
  } else {
    const result = setupStandardPalette(
      preprocessedImage,
      globalPalette,
      nColors,
      cpcClassicPalette,
      useProvidedPalette,
      quantizeColor
    )
    basePalette = result.basePalette
    rasterSlotStart = 0
    rasterSlotEnd = nColors
  }

  // Current palette starts from base and evolves line by line
  let currentPalette = [...basePalette]

  // Process each line
  for (let line = 0; line < imageHeight; line++) {
    const colorFrequencies = extractLineColorFrequencies(
      preprocessedImage,
      line
    )

    const newPalette = isMode0Plus
      ? processMode0PlusLine(
          colorFrequencies,
          currentPalette,
          basePalette,
          rasterSlotEnd,
          quantizeColor
        )
      : processStandardLine(
          colorFrequencies,
          currentPalette,
          basePalette,
          nColors,
          cpcClassicPalette,
          quantizeColor
        )

    // Collect and apply changes
    const lineChanges = collectLineChanges({
      line,
      currentPalette,
      newPalette,
      rasterSlotStart,
      rasterSlotEnd,
      existingChangeSet,
      data,
      width,
      quantizeColor
    })

    // Apply maxChangesPerLine constraint
    const finalPalette = applyChangeLimit(
      lineChanges,
      maxChangesPerLine,
      currentPalette,
      newPalette
    )

    // Add the selected changes
    for (const change of lineChanges.slice(0, maxChangesPerLine)) {
      changes.push({
        line,
        inkIndex: change.inkIndex,
        color: change.newColor
      })
    }

    // Build index buffer for this line
    buildLineIndexBuffer(
      line,
      width,
      data,
      finalPalette,
      indexBuffer,
      quantizeColor
    )

    // Update current palette for next line
    currentPalette = finalPalette
  }

  // Combine with existing changes
  const allChanges = [...existingChanges, ...changes]
  const sortedChanges = allChanges.slice().sort((a, b) => a.line - b.line)

  return {
    changes: sortedChanges,
    indexBuffer,
    quantizedGlobalPalette: [...basePalette]
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolves the fixed (non-raster) colors for a Mode 0 CPC Plus base palette,
 * either from the caller-provided palette or by extracting them from the image.
 */
function resolveMode0PlusFixedColors(
  preprocessedImage: ImageData,
  globalPalette: Vector<'RGB'>[],
  numRasterSlots: number,
  numFixedColors: number,
  cpcClassicPalette: Vector<'RGB'>[] | undefined,
  useProvidedPalette: boolean,
  quantizeColor: (color: Vector<'RGB'>) => Vector<'RGB'>
): Vector<'RGB'>[] {
  const extractFromImage = () =>
    extractGlobalColorsForMode0Plus(
      preprocessedImage,
      cpcClassicPalette,
      numFixedColors
    )

  if (!(useProvidedPalette && globalPalette.length > 0)) {
    return extractFromImage()
  }

  if (globalPalette.length === numFixedColors) {
    return globalPalette.map((c) => quantizeColor(c))
  }

  if (globalPalette.length >= MODE_0_TOTAL_COLORS) {
    return globalPalette
      .slice(numRasterSlots, MODE_0_TOTAL_COLORS)
      .map((c) => quantizeColor(c))
  }

  // Too few provided colors: quantize what we have, then pad from the image.
  const globalColors = globalPalette.map((c) => quantizeColor(c))
  if (globalColors.length < numFixedColors) {
    const extracted = extractFromImage()
    while (globalColors.length < numFixedColors) {
      globalColors.push(extracted[globalColors.length] || [0, 0, 0])
    }
  }
  return globalColors
}

function setupMode0PlusPalette(
  preprocessedImage: ImageData,
  globalPalette: Vector<'RGB'>[],
  maxChangesPerLine: number,
  cpcClassicPalette: Vector<'RGB'>[] | undefined,
  useProvidedPalette: boolean,
  quantizeColor: (color: Vector<'RGB'>) => Vector<'RGB'>
): {
  basePalette: Vector<'RGB'>[]
  rasterSlotStart: number
  rasterSlotEnd: number
} {
  const numRasterSlots = Math.min(maxChangesPerLine, MODE_0_RASTER_SLOTS)
  const numFixedColors = MODE_0_TOTAL_COLORS - numRasterSlots

  const globalColors = resolveMode0PlusFixedColors(
    preprocessedImage,
    globalPalette,
    numRasterSlots,
    numFixedColors,
    cpcClassicPalette,
    useProvidedPalette,
    quantizeColor
  )

  const basePalette = new Array(MODE_0_TOTAL_COLORS) as Vector<'RGB'>[]
  for (let i = 0; i < numRasterSlots; i++) {
    basePalette[i] = [0, 0, 0]
  }
  for (let i = 0; i < numFixedColors; i++) {
    basePalette[numRasterSlots + i] = globalColors[i] || [0, 0, 0]
  }

  return {
    basePalette,
    rasterSlotStart: 0,
    rasterSlotEnd: numRasterSlots
  }
}

function setupStandardPalette(
  preprocessedImage: ImageData,
  globalPalette: Vector<'RGB'>[],
  nColors: number,
  cpcClassicPalette: Vector<'RGB'>[] | undefined,
  useProvidedPalette: boolean,
  quantizeColor: (color: Vector<'RGB'>) => Vector<'RGB'>
): { basePalette: Vector<'RGB'>[] } {
  let extractedPalette: Vector<'RGB'>[]
  if (useProvidedPalette && globalPalette.length >= nColors) {
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

  const basePalette = [...extractedPalette]
  while (basePalette.length < nColors) {
    basePalette.push([0, 0, 0])
  }

  return { basePalette }
}

function processMode0PlusLine(
  colorFrequencies: Map<string, { color: Vector<'RGB'>; count: number }>,
  currentPalette: Vector<'RGB'>[],
  basePalette: Vector<'RGB'>[],
  rasterSlotEnd: number,
  quantizeColor: (color: Vector<'RGB'>) => Vector<'RGB'>
): Vector<'RGB'>[] {
  const fixedPalette = basePalette.slice(rasterSlotEnd)
  const uncoveredColors: Array<{
    color: Vector<'RGB'>
    error: number
    count: number
  }> = []

  for (const { color, count } of colorFrequencies.values()) {
    const quantized = quantizeColor(color)
    const closestFixedIdx = findClosestColorIndex(
      quantized,
      fixedPalette,
      weightedRGBDistance
    )
    const closestFixed = fixedPalette[closestFixedIdx]
    const error = weightedRGBDistance(quantized, closestFixed)

    if (error > 0) {
      uncoveredColors.push({ color: quantized, error, count })
    }
  }

  uncoveredColors.sort((a, b) => b.error * b.count - a.error * a.count)

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

  const newPalette = [...currentPalette]
  const previousRasterSlots = currentPalette.slice(0, rasterSlotEnd)
  const assignedSlots = new Set<number>()
  const assignedColors = new Set<string>()

  // First pass: exact matches
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

  // Second pass: assign remaining
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

  return newPalette
}

function processStandardLine(
  colorFrequencies: Map<string, { color: Vector<'RGB'>; count: number }>,
  currentPalette: Vector<'RGB'>[],
  basePalette: Vector<'RGB'>[],
  nColors: number,
  cpcClassicPalette: Vector<'RGB'>[] | undefined,
  quantizeColor: (color: Vector<'RGB'>) => Vector<'RGB'>
): Vector<'RGB'>[] {
  const lineColors = selectBestColorsForLine(
    colorFrequencies,
    currentPalette,
    basePalette,
    nColors,
    cpcClassicPalette
  )

  const quantizedLineColors = lineColors.map((c) => quantizeColor(c))
  return assignColorsToInks(quantizedLineColors, currentPalette)
}

interface LineChange {
  inkIndex: number
  prevColor: Vector<'RGB'>
  newColor: Vector<'RGB'>
  impact: number
}

interface CollectLineChangesParams {
  line: number
  currentPalette: Vector<'RGB'>[]
  newPalette: Vector<'RGB'>[]
  rasterSlotStart: number
  rasterSlotEnd: number
  existingChangeSet: Set<string>
  data: Uint8ClampedArray
  width: number
  quantizeColor: (color: Vector<'RGB'>) => Vector<'RGB'>
}

function collectLineChanges({
  line,
  currentPalette,
  newPalette,
  rasterSlotStart,
  rasterSlotEnd,
  existingChangeSet,
  data,
  width,
  quantizeColor
}: CollectLineChangesParams): LineChange[] {
  const lineChanges: LineChange[] = []

  for (let inkIndex = rasterSlotStart; inkIndex < rasterSlotEnd; inkIndex++) {
    const prevColor = currentPalette[inkIndex]
    const newColor = newPalette[inkIndex]

    if (existingChangeSet.has(`${line}-${inkIndex}`)) continue

    if (!colorsEqual(prevColor, newColor)) {
      const colorDiff = weightedRGBDistance(prevColor, newColor)
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

  lineChanges.sort((a, b) => b.impact - a.impact)
  return lineChanges
}

function applyChangeLimit(
  lineChanges: LineChange[],
  maxChangesPerLine: number,
  currentPalette: Vector<'RGB'>[],
  newPalette: Vector<'RGB'>[]
): Vector<'RGB'>[] {
  if (lineChanges.length <= maxChangesPerLine) {
    return newPalette
  }

  const limitedPalette = [...currentPalette]
  for (const change of lineChanges.slice(0, maxChangesPerLine)) {
    limitedPalette[change.inkIndex] = change.newColor
  }
  return limitedPalette
}

function buildLineIndexBuffer(
  line: number,
  width: number,
  data: Uint8ClampedArray,
  palette: Vector<'RGB'>[],
  indexBuffer: Uint8Array,
  quantizeColor: (color: Vector<'RGB'>) => Vector<'RGB'>
): void {
  const colorToInk = new Map<string, number>()
  for (let inkIndex = 0; inkIndex < palette.length; inkIndex++) {
    const key = colorKey(palette[inkIndex])
    if (!colorToInk.has(key)) {
      colorToInk.set(key, inkIndex)
    }
  }

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

    let inkIndex = colorToInk.get(key)
    inkIndex ??= findClosestColorIndex(
      quantizedPixel,
      palette,
      weightedRGBDistance
    )

    indexBuffer[lineStart + x] = inkIndex
  }
}

// Re-export for convenience
export { quantizeToCPCPlus } from './color-quantization'
