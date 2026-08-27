/**
 * EGX Mode Types
 *
 * Types specific to EGX (Enhanced Graphics eXtended) mode.
 *
 * EGX is a spatial interlacing technique that alternates video modes
 * line by line to achieve a compromise between resolution and colors:
 *
 * - EGX1: Alternates Mode 0 (16 colors) and Mode 1 (4 colors)
 *         Result: 320×200 with up to 16 colors
 *         Constraint: Mode 1 lines can only use INK 0-3
 *
 * - EGX2: Alternates Mode 1 (4 colors) and Mode 2 (2 colors)
 *         Result: 640×200 with up to 4 colors
 *         Constraint: Mode 2 lines can only use INK 0-1
 *
 * Unlike Mode R (temporal interlacing at 50Hz), EGX has no flicker
 * because there's no frame alternation - just different modes per line.
 */

import type { DitheringMode } from '@/libs/pixsaur-color/src'
import type { Vector } from '@/libs/pixsaur-color/src/type'

// ============================================================================
// EGX Types
// ============================================================================

/**
 * EGX variant type
 * - egx1: Mode 0 (160px, 16 colors) / Mode 1 (320px, 4 colors)
 * - egx2: Mode 1 (320px, 4 colors) / Mode 2 (640px, 2 colors)
 */
export type EGXType = 'egx1' | 'egx2'

/**
 * Which mode is used for the first line (line 0)
 * - 'low': Lower resolution mode first (Mode 0 for EGX1, Mode 1 for EGX2)
 * - 'high': Higher resolution mode first (Mode 1 for EGX1, Mode 2 for EGX2)
 */
export type EGXFirstLineMode = 'low' | 'high'

/**
 * EGX preview visualization modes
 */
export type EGXPreviewMode =
  | 'combined' // Final combined view with all modes
  | 'highLines' // Only high-resolution lines (Mode 1 or Mode 2)
  | 'lowLines' // Only low-resolution lines (Mode 0 or Mode 1)

/**
 * CPC video mode (0, 1, or 2)
 */
export type CPCVideoMode = 0 | 1 | 2

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for EGX quantization
 */
export interface EGXConfig {
  /**
   * EGX variant
   * - egx1: Mode 0/1 alternation (320×200, up to 16 colors)
   * - egx2: Mode 1/2 alternation (640×200, up to 4 colors)
   */
  type: EGXType

  /**
   * Mode used for the first line (line 0)
   * - 'low': Start with lower resolution mode (more colors)
   * - 'high': Start with higher resolution mode (fewer colors)
   */
  firstLineMode: EGXFirstLineMode

  /**
   * Hardware target for color quantization
   * - 'classic': 27 CPC colors available
   * - 'plus': 4096 CPC Plus colors available
   */
  targetHardware: 'classic' | 'plus'

  /**
   * Dithering mode
   * - 'none': No dithering
   * - 'floydSteinberg': Floyd-Steinberg error diffusion
   * - 'atkinson': Atkinson error diffusion
   * - 'bayer2x2', 'bayer4x4', 'bayer8x8': Ordered Bayer dithering
   * - etc.
   */
  ditheringMode: 'none' | DitheringMode

  /**
   * Dithering intensity (0-100)
   * 0 = no dithering effect, 100 = full dithering
   */
  ditheringIntensity: number

  /**
   * Enable diffusion correction:
   * - Clamp accumulated error to ±64 to prevent smearing
   * - Clamp pixel+error to palette gamut before quantization
   */
  useDiffusionCorrection?: boolean

  /**
   * Enable ordered correction:
   * - Adaptive amplitude: intensity × (255 / √paletteSize)
   * - Skip perturbation when pixel is at gamut boundary
   */
  useOrderedCorrection?: boolean
}

/**
 * Default EGX configuration
 */
export const DEFAULT_EGX_CONFIG: EGXConfig = {
  type: 'egx1',
  firstLineMode: 'low', // Start with Mode 0 (more colors)
  targetHardware: 'plus',
  ditheringMode: 'floydSteinberg',
  ditheringIntensity: 100
}

// ============================================================================
// Palette Types
// ============================================================================

/**
 * Statistics about an EGX palette
 */
export interface EGXPaletteStats {
  /** Number of colors used in low-resolution mode lines */
  colorsUsedLowMode: number
  /** Number of colors used in high-resolution mode lines */
  colorsUsedHighMode: number
  /** Average quantization error for low-resolution lines */
  avgErrorLowMode: number
  /** Average quantization error for high-resolution lines */
  avgErrorHighMode: number
  /** Total quantization error */
  totalError: number
}

/**
 * EGX palette with shared color constraints
 *
 * For EGX1: INK 0-3 are shared (used by both Mode 0 and Mode 1 lines)
 * For EGX2: INK 0-1 are shared (used by both Mode 1 and Mode 2 lines)
 */
export interface EGXPalette {
  /** Full palette (16 colors for EGX1, 4 colors for EGX2) */
  colors: Array<Vector<'RGB'>>

  /** Number of shared colors (4 for EGX1, 2 for EGX2) */
  sharedColorCount: number

  /** Statistics about palette usage */
  stats: EGXPaletteStats
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the CPC modes used for an EGX type
 */
export function getEGXModes(type: EGXType): {
  lowMode: 0 | 1
  highMode: 1 | 2
} {
  switch (type) {
    case 'egx1':
      return { lowMode: 0, highMode: 1 }
    case 'egx2':
      return { lowMode: 1, highMode: 2 }
  }
}

/**
 * Get the number of shared colors for an EGX type
 */
export function getSharedColorCount(type: EGXType): number {
  switch (type) {
    case 'egx1':
      return 4 // INK 0-3 shared between Mode 0 and Mode 1
    case 'egx2':
      return 2 // INK 0-1 shared between Mode 1 and Mode 2
  }
}

/**
 * Get the total palette size for an EGX type
 */
export function getTotalPaletteSize(type: EGXType): number {
  switch (type) {
    case 'egx1':
      return 16 // Mode 0 uses 16 colors
    case 'egx2':
      return 4 // Mode 1 uses 4 colors
  }
}

/**
 * Get the maximum color index for a given mode in an EGX context
 */
export function getMaxColorIndex(mode: CPCVideoMode, type: EGXType): number {
  if (type === 'egx1') {
    return mode === 0 ? 15 : 3 // Mode 0: 0-15, Mode 1: 0-3
  } else {
    return mode === 1 ? 3 : 1 // Mode 1: 0-3, Mode 2: 0-1
  }
}

/**
 * Get the mode for a specific line based on configuration
 */
export function getModeForLine(
  lineNumber: number,
  config: EGXConfig
): CPCVideoMode {
  const { lowMode, highMode } = getEGXModes(config.type)
  const isEvenLine = lineNumber % 2 === 0

  if (config.firstLineMode === 'low') {
    // Even lines: low mode, Odd lines: high mode
    return isEvenLine ? lowMode : highMode
  } else {
    // Even lines: high mode, Odd lines: low mode
    return isEvenLine ? highMode : lowMode
  }
}
