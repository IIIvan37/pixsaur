// Pixel mode represents ONLY the pixel aspect ratio (not dimensions)
export type PixelMode = 0 | 1 | 2

// Dimension preset type (standard, overscan, or custom)
export type DimensionPreset = 'standard' | 'overscan' | 'custom'

// Custom dimensions configuration
export interface CustomDimensions {
  width: number
  height: number
}

// Legacy CpcModeKey for backward compatibility (will be deprecated)
export type CpcModeKey =
  | '0'
  | '1'
  | '2'
  | '0-overscan'
  | '1-overscan'
  | '2-overscan'

// Processor types for image processing
export type ProcessorType = 'auto' | 'cpu' | 'gpu'

// Palette selection strategy for color quantization
export type PaletteStrategy =
  | 'exhaustive-contrast' // Exhaustive search: tests all combinations, maximizes min distance
  | 'coverage-aware' // Maximizes coverage of image colors within threshold
  | 'dithering-aware' // Selects colors that blend well for dithering
  | 'frequency-balanced' // Original: frequency + diversity, mode balanced (80% freq)
  | 'frequency-max' // Original: frequency + diversity, max contrast (60% freq)
  | 'balanced-score-balanced' // Multi-criteria: 50% freq, 25% diversity, 25% luminance
  | 'balanced-score-max' // Multi-criteria: 30% freq, 35% diversity, 35% luminance
  | 'perceptual-balanced' // Luminance bins with frequency priority
  | 'perceptual-max' // Luminance bins with diversity priority
  | 'diversity-first-balanced' // Diversity max with slight frequency (90% div, 10% freq)
  | 'diversity-first-max' // Pure diversity (100% div, 0% freq)
  | 'adaptive' // Adaptive based on image analysis

// This file defines types and constants related to CPC modes and color adjustments.
export type CpcModeConfig = {
  overscan: boolean
  mode: 0 | 1 | 2
  width: number
  height: number
  nColors: number
  scaleX: number
  scaleY: number
}

export const CPC_MODE_CONFIG: Record<CpcModeKey, CpcModeConfig> = {
  '0': {
    overscan: false,
    mode: 0,
    width: 160,
    height: 200,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  },
  '1': {
    overscan: false,
    mode: 1,
    width: 320,
    height: 200,
    nColors: 4,
    scaleX: 1,
    scaleY: 1
  },
  '2': {
    overscan: false,
    mode: 2,
    width: 640,
    height: 200,
    nColors: 2,
    scaleX: 1,
    scaleY: 2
  },
  '0-overscan': {
    overscan: true,
    mode: 0,
    width: 48 * 2 * 2,
    height: 280,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  },
  '1-overscan': {
    overscan: true,
    mode: 1,
    width: 48 * 2 * 4,
    height: 280,
    nColors: 4,
    scaleX: 1,
    scaleY: 1
  },
  '2-overscan': {
    overscan: true,
    mode: 2,
    width: 48 * 2 * 8,
    height: 280,
    nColors: 2,
    scaleX: 1,
    scaleY: 2
  }
}

/**
 * Helper function to build a CpcModeKey from pixel mode and dimension preset
 * Note: This only works for 'standard' and 'overscan' presets, not 'custom'
 * @param pixelMode - The pixel aspect ratio mode (0, 1, or 2)
 * @param dimensionPreset - The dimension preset ('standard' or 'overscan')
 * @returns The combined CpcModeKey
 */
export function buildCpcModeKey(
  pixelMode: PixelMode,
  dimensionPreset: Exclude<DimensionPreset, 'custom'>
): CpcModeKey {
  if (dimensionPreset === 'standard') {
    return pixelMode.toString() as CpcModeKey
  }
  return `${pixelMode}-overscan` as CpcModeKey
}

/**
 * Helper function to build CpcModeConfig from pixel mode and custom dimensions
 * @param pixelMode - The pixel aspect ratio mode (0, 1, or 2)
 * @param dimensions - Custom width and height
 * @returns Complete CpcModeConfig for custom dimensions
 */
export function buildCustomModeConfig(
  pixelMode: PixelMode,
  dimensions: CustomDimensions
): CpcModeConfig {
  const baseConfig = CPC_MODE_CONFIG[pixelMode.toString() as CpcModeKey]
  return {
    ...baseConfig,
    width: dimensions.width,
    height: dimensions.height,
    overscan: false // Custom dimensions don't use overscan flag
  }
}

/**
 * Helper function to extract pixel mode and dimension preset from a CpcModeKey
 * @param modeKey - The combined CpcModeKey
 * @returns Object with pixelMode and dimensionPreset
 */
export function parseCpcModeKey(modeKey: CpcModeKey): {
  pixelMode: PixelMode
  dimensionPreset: DimensionPreset
} {
  const isOverscan = modeKey.includes('-overscan')
  const pixelMode = Number.parseInt(modeKey[0], 10) as PixelMode
  return {
    pixelMode,
    dimensionPreset: isOverscan ? 'overscan' : 'standard'
  }
}

export type AdjustementKey =
  | 'red'
  | 'green'
  | 'blue'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hue'
  | 'vibrance'
  | 'temperature'
  | 'tint'
  | 'gamma'
  | 'exposure'
  | 'highlights'
  | 'shadows'
  | 'posterization'
  | 'sharpen'
  | 'blur'
  | 'edges'
