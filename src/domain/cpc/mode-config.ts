/**
 * CPC mode configuration — source of truth for mode 0/1/2 dimensions,
 * color counts and pixel aspect ratios (standard and overscan variants).
 */

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
  return `${pixelMode}-overscan`
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

/**
 * The shape of a CPC pixel in `mode`, as a width-to-height ratio.
 *
 * Read from `scaleX`/`scaleY`, NOT from the physical 4:3 aspect of the screen:
 * consistency with the rest of the app, which reasons in the same units. A
 * mode 0 pixel is twice as wide as it is tall, a mode 1 one is square, and a
 * mode 2 one is twice as tall as it is wide.
 */
export function cpcPixelAspect(mode: PixelMode): { x: number; y: number } {
  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${mode}` as CpcModeKey]
  return { x: scaleX, y: scaleY }
}
