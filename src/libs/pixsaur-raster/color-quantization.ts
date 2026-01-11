/**
 * CPC Color Quantization
 *
 * Functions for quantizing colors to CPC hardware constraints:
 * - CPC Plus: 4096 colors (4 bits per channel)
 * - CPC Classic: 27 colors (fixed palette)
 *
 * Uses pre-computed lookup tables for fast CPC Classic quantization.
 */

import { weightedRGBDistance } from '../pixsaur-color/src/metric/distance'
import { findClosestColorIndex } from '../pixsaur-color/src/metric/find-closest'
import type { Vector } from '../pixsaur-color/src/type'

// ============================================================================
// CPC Plus Quantization (4096 colors)
// ============================================================================

/**
 * Quantize an RGB color to CPC Plus 4-bit format (16 levels per component)
 */
export function quantizeToCPCPlus(color: Vector<'RGB'>): Vector<'RGB'> {
  const quantize = (v: number) => Math.round(v / 17) * 17
  return [quantize(color[0]), quantize(color[1]), quantize(color[2])]
}

// ============================================================================
// CPC Classic Quantization (27 colors via LUT)
// ============================================================================

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
export function buildCPCClassicLUT(palette: Vector<'RGB'>[]): Uint8Array {
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
export function quantizeToCPCClassicWithLUT(
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

// ============================================================================
// LUT Cache Management
// ============================================================================

/**
 * Get or build the CPC Classic LUT for a palette
 */
export function getCPCClassicLUT(palette: Vector<'RGB'>[]): Uint8Array {
  if (!cpcClassicLUT || cpcClassicLUTPalette !== palette) {
    cpcClassicLUT = buildCPCClassicLUT(palette)
    cpcClassicLUTPalette = palette
  }
  return cpcClassicLUT
}

/**
 * Check if LUT needs rebuilding for the given palette
 */
export function needsLUTRebuild(palette: Vector<'RGB'>[]): boolean {
  return !cpcClassicLUT || cpcClassicLUTPalette !== palette
}

/**
 * Invalidate the cached LUT (for testing or palette changes)
 */
export function invalidateLUTCache(): void {
  cpcClassicLUT = null
  cpcClassicLUTPalette = null
}

// ============================================================================
// Quantization Factory
// ============================================================================

/**
 * Create a quantization function based on hardware mode
 */
export function createQuantizeFunction(
  cpcClassicPalette?: Vector<'RGB'>[],
  lut?: Uint8Array | null
): (color: Vector<'RGB'>) => Vector<'RGB'> {
  if (cpcClassicPalette && lut) {
    return (color: Vector<'RGB'>) =>
      quantizeToCPCClassicWithLUT(color, cpcClassicPalette, lut)
  }
  return quantizeToCPCPlus
}
