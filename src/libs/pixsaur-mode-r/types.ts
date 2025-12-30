/**
 * Mode R Types
 *
 * Types specific to Mode R (interlaced dual-image) operations.
 *
 * Mode R uses TWO images in memory at Mode 0 resolution (e.g., 160×200).
 * The pixel extraction alternates line by line:
 * - Even lines: Image A gets even pixels, Image B gets odd pixels
 * - Odd lines: Image A gets odd pixels, Image B gets even pixels
 *
 * Combined with horizontal shift that alternates per line and inverts
 * between frames, this creates a perceived doubled horizontal resolution.
 */

import type { DitheringMode } from '@/libs/pixsaur-color/src'
import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * A color pair for Mode R - one color from each alternating palette
 */
export interface ModeRColorPair {
  /** Index in the palette (0-15) */
  index: number
  /** Color displayed in frame A (odd frames) */
  colorA: Vector<'RGB'>
  /** Color displayed in frame B (even frames) */
  colorB: Vector<'RGB'>
  /** Perceived blended color (average of A and B) */
  blendedColor: Vector<'RGB'>
  /** Flicker score: luminance difference between A and B (0 = no flicker) */
  flickerScore: number
}

/**
 * Complete Mode R palette configuration
 */
export interface ModeRPalettes {
  /** Palette A: 16 colors displayed on frame A */
  paletteA: Array<Vector<'RGB'>>
  /** Palette B: 16 colors displayed on frame B */
  paletteB: Array<Vector<'RGB'>>
  /** The 16 color pairs with their properties */
  pairs: ModeRColorPair[]
  /** Statistics about the palette */
  stats: ModeRPaletteStats
}

/**
 * Statistics about a Mode R palette
 */
export interface ModeRPaletteStats {
  /** Average flicker score across all pairs */
  averageFlicker: number
  /** Maximum flicker score (worst pair) */
  maxFlicker: number
  /** Number of pairs with zero flicker (same color in A and B) */
  noFlickerPairs: number
  /** Number of unique perceived colors */
  uniquePerceivedColors: number
}

/**
 * Configuration for Mode R optimization
 */
export interface ModeRConfig {
  /**
   * Anti-flicker weight (0-100)
   * Higher values prioritize flicker reduction over color accuracy
   * - 0: Pure color accuracy (may have visible flicker)
   * - 50: Balanced
   * - 100: Minimal flicker (may sacrifice color accuracy)
   */
  antiFlickerWeight: number

  /**
   * Maximum luminance delta allowed between pair colors
   * Pairs with higher delta will be penalized or rejected
   * Range: 0-255 (0 = no tolerance, 255 = any luminance difference allowed)
   */
  maxLuminanceDelta: number

  /**
   * Hardware target for color quantization
   * - 'classic': 27 CPC colors available
   * - 'plus': 4096 CPC Plus colors available
   */
  targetHardware: 'classic' | 'plus'

  /**
   * Dithering mode - supports all standard dithering algorithms
   * - 'none': No dithering
   * - 'floydSteinberg': Floyd-Steinberg error diffusion
   * - 'atkinson': Atkinson error diffusion (sharper)
   * - 'bayer2x2', 'bayer4x4', 'bayer8x8': Ordered Bayer dithering
   * - 'halftone4x4': Halftone pattern dithering
   * - 'ylioluma1', 'ylioluma2': Yliluoma's ordered dithering
   */
  ditheringMode: 'none' | DitheringMode

  /**
   * Dithering intensity (0-100)
   * 0 = no dithering effect, 100 = full dithering
   */
  ditheringIntensity: number

  /**
   * Use dual palettes (different palette for each frame)
   * - false: Same palette for both frames (less flicker, simpler)
   * - true: Independent palettes for each frame (more colors, more flicker)
   */
  useDualPalette: boolean
}

/**
 * Default Mode R configuration
 */
export const DEFAULT_MODE_R_CONFIG: ModeRConfig = {
  antiFlickerWeight: 70, // Prioritize flicker reduction
  maxLuminanceDelta: 80, // Allow moderate luminance differences
  targetHardware: 'plus', // Mode R works best on CPC Plus
  ditheringMode: 'floydSteinberg',
  ditheringIntensity: 100,
  useDualPalette: false // Default: same palette for both frames (less flicker)
}

/**
 * Result of full Mode R quantization
 *
 * Produces TWO index buffers at Mode 0 resolution.
 * The pixel extraction pattern alternates line by line.
 */
export interface ModeRQuantizationResult {
  /** Index buffer for Image A (indices 0-15 into paletteA) */
  indexBufferA: Uint8Array
  /** Index buffer for Image B (indices 0-15 into paletteB) */
  indexBufferB: Uint8Array
  /** The dual palettes */
  palettes: ModeRPalettes
  /** Total quantization error */
  totalError: number
}
