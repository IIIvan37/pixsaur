/**
 * Median Cut Algorithm
 *
 * Quantizes a set of weighted colors to N representative colors.
 * Based on Heckbert's 1982 algorithm with weighted pixels.
 */

import type { Vector } from '../pixsaur-color/src/type'

// ============================================================================
// Types
// ============================================================================

/**
 * Weighted color pixel for median cut algorithm
 */
export interface WeightedPixel {
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

// ============================================================================
// Box Operations
// ============================================================================

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

// ============================================================================
// Main Algorithm
// ============================================================================

/**
 * Median cut algorithm to quantize colors to n representative colors.
 * Based on Heckbert's 1982 algorithm with weighted pixels.
 *
 * @param pixels - Array of weighted pixels (color + frequency)
 * @param numColors - Target number of colors (usually 4)
 * @returns Array of representative colors
 */
export function medianCut(
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
