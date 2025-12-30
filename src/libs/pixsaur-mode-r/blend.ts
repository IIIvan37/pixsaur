/**
 * Mode R Blend Operations
 *
 * Functions for calculating perceived colors from alternating frames.
 * The human eye blends the two alternating frames at 50Hz.
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * Calculate luminance (Y) from RGB using Rec. 709 coefficients
 * This matches human perception of brightness
 */
export function calculateLuminance(color: Vector<'RGB'>): number {
  return 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]
}

/**
 * Calculate the perceived blended color from two alternating colors
 * Uses linear RGB blending (physically accurate for light mixing)
 *
 * @param colorA - Color displayed in frame A
 * @param colorB - Color displayed in frame B
 * @returns The perceived blended color
 */
export function blendColors(
  colorA: Vector<'RGB'>,
  colorB: Vector<'RGB'>
): Vector<'RGB'> {
  return [
    Math.round((colorA[0] + colorB[0]) / 2),
    Math.round((colorA[1] + colorB[1]) / 2),
    Math.round((colorA[2] + colorB[2]) / 2)
  ]
}

/**
 * Calculate the flicker score between two colors
 * Flicker is primarily caused by luminance differences
 *
 * @param colorA - Color displayed in frame A
 * @param colorB - Color displayed in frame B
 * @returns Flicker score (0 = no flicker, higher = more flicker)
 */
export function calculateFlickerScore(
  colorA: Vector<'RGB'>,
  colorB: Vector<'RGB'>
): number {
  const lumA = calculateLuminance(colorA)
  const lumB = calculateLuminance(colorB)
  return Math.abs(lumA - lumB)
}

/**
 * Calculate color distance in RGB space
 * Uses weighted Euclidean distance matching human color perception
 */
export function colorDistance(
  color1: Vector<'RGB'>,
  color2: Vector<'RGB'>
): number {
  // Weighted by human perception sensitivity (green > red > blue)
  const rDiff = color1[0] - color2[0]
  const gDiff = color1[1] - color2[1]
  const bDiff = color1[2] - color2[2]

  return Math.sqrt(2 * rDiff * rDiff + 4 * gDiff * gDiff + 3 * bDiff * bDiff)
}

/**
 * Calculate the total cost of using a color pair to represent a target color
 *
 * @param targetColor - The desired perceived color
 * @param colorA - Palette A color
 * @param colorB - Palette B color
 * @param antiFlickerWeight - Weight for flicker penalty (0-100)
 * @returns Total cost (lower is better)
 */
export function calculatePairCost(
  targetColor: Vector<'RGB'>,
  colorA: Vector<'RGB'>,
  colorB: Vector<'RGB'>,
  antiFlickerWeight: number
): number {
  const blended = blendColors(colorA, colorB)
  const colorError = colorDistance(targetColor, blended)
  const flicker = calculateFlickerScore(colorA, colorB)

  // Normalize anti-flicker weight to 0-1 range
  const flickerWeight = antiFlickerWeight / 100

  // Color error is the primary factor
  // Flicker penalty only applies when antiFlickerWeight > 0
  // Scale flicker penalty more gently to not overwhelm color accuracy
  const flickerPenalty = flicker * flickerWeight

  return colorError + flickerPenalty
}

/**
 * Quantize a color to CPC Plus palette (4-bit per channel)
 */
export function quantizeToCPCPlus(color: Vector<'RGB'>): Vector<'RGB'> {
  const quantize = (v: number): number => {
    // CPC Plus uses 16 levels (0-15), mapped to 0, 17, 34, ..., 255
    const level = Math.round(v / 17)
    return Math.min(15, Math.max(0, level)) * 17
  }
  return [quantize(color[0]), quantize(color[1]), quantize(color[2])]
}

/**
 * Quantize a color to CPC Classic palette (3 levels per channel)
 */
export function quantizeToCPCClassic(color: Vector<'RGB'>): Vector<'RGB'> {
  const quantize = (v: number): number => {
    // CPC Classic uses 3 levels: 0, 128, 255
    if (v < 64) return 0
    if (v < 192) return 128
    return 255
  }
  return [quantize(color[0]), quantize(color[1]), quantize(color[2])]
}
