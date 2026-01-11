/**
 * CPC Dimensions Configuration
 *
 * Single responsibility: Pixel mode and dimension management
 */

import { atom } from 'jotai'
import { getWidthStepForMode } from '@/export'
import type {
  CpcModeConfig,
  CpcModeKey,
  CustomDimensions,
  DimensionPreset,
  PixelMode
} from './types'
import {
  buildCpcModeKey,
  buildCustomModeConfig,
  CPC_MODE_CONFIG,
  parseCpcModeKey
} from './types'

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * Pixel mode (0, 1, or 2) - controls pixel aspect ratio
 */
export const pixelModeAtom = atom<PixelMode>(0)

/**
 * Dimension preset (standard, overscan, or custom)
 */
export const dimensionPresetAtom = atom<DimensionPreset>('standard')

/**
 * Custom dimensions - only used when dimensionPreset is 'custom'
 */
export const customDimensionsAtom = atom<CustomDimensions>({
  width: 160,
  height: 200
})

// ============================================================================
// DERIVED ATOMS
// ============================================================================

/**
 * Legacy mode key derived from pixelMode + dimensionPreset
 * Maintains backward compatibility with existing code
 */
export const derivedModeAtom = atom(
  (get) => {
    const pixelMode = get(pixelModeAtom)
    const dimensionPreset = get(dimensionPresetAtom)

    if (dimensionPreset === 'custom') {
      return pixelMode.toString() as CpcModeKey
    }

    return buildCpcModeKey(pixelMode, dimensionPreset)
  },
  (_get, set, payload: CpcModeKey) => {
    const { pixelMode, dimensionPreset } = parseCpcModeKey(payload)
    set(pixelModeAtom, pixelMode)
    set(dimensionPresetAtom, dimensionPreset)
  }
)

/**
 * Effective mode configuration
 * Returns complete CPC mode config based on current settings
 */
export const effectiveModeConfigAtom = atom((get): CpcModeConfig => {
  const pixelMode = get(pixelModeAtom)
  const dimensionPreset = get(dimensionPresetAtom)
  const customDimensions = get(customDimensionsAtom)

  if (dimensionPreset === 'custom') {
    return buildCustomModeConfig(pixelMode, customDimensions)
  }

  const modeKey = buildCpcModeKey(pixelMode, dimensionPreset)
  return CPC_MODE_CONFIG[modeKey]
})

// ============================================================================
// SETTERS
// ============================================================================

/**
 * Base setter for pixel mode
 * Adjusts custom width when mode changes to maintain byte count
 */
export const setPixelModeBaseAtom = atom(
  null,
  (get, set, payload: PixelMode) => {
    const dimensionPreset = get(dimensionPresetAtom)
    const previousMode = get(pixelModeAtom)

    set(pixelModeAtom, payload)

    // Adjust custom dimensions width when mode changes
    if (dimensionPreset === 'custom' && previousMode !== payload) {
      const currentDimensions = get(customDimensionsAtom)
      const currentWidth = currentDimensions.width

      const currentPixelsPerByte = getWidthStepForMode(previousMode)
      const byteWidth = currentWidth / currentPixelsPerByte

      const newPixelsPerByte = getWidthStepForMode(payload)
      const newWidth = byteWidth * newPixelsPerByte

      const widthStep = getWidthStepForMode(payload)
      const adjustedWidth = Math.round(newWidth / widthStep) * widthStep
      const finalWidth = Math.max(4, Math.min(768, adjustedWidth))

      set(customDimensionsAtom, {
        ...currentDimensions,
        width: finalWidth
      })
    }
  }
)

/**
 * Setter for dimension preset
 * Inherits current effective dimensions when switching to custom
 */
export const setDimensionPresetAtom = atom(
  null,
  (get, set, payload: DimensionPreset) => {
    const currentPreset = get(dimensionPresetAtom)

    if (payload === 'custom' && currentPreset !== 'custom') {
      const currentConfig = get(effectiveModeConfigAtom)
      set(customDimensionsAtom, {
        width: currentConfig.width,
        height: currentConfig.height
      })
    }

    set(dimensionPresetAtom, payload)
  }
)

/**
 * Setter for custom dimensions
 */
export const setCustomDimensionsAtom = atom(
  null,
  (_get, set, payload: CustomDimensions) => {
    set(customDimensionsAtom, payload)
  }
)

// ============================================================================
// COMPATIBILITY ALIASES
// ============================================================================

/**
 * Mode atom - alias for derivedModeAtom
 * Returns CpcModeKey based on pixelMode + dimensionPreset
 */
export const modeAtom = derivedModeAtom

/**
 * Set mode via CpcModeKey - updates both pixelMode and dimensionPreset
 */
export const setModeAtom = atom(null, (_get, set, payload: CpcModeKey) => {
  set(derivedModeAtom, payload)
})

// Alias for external use with EGX constraint handling (defined in config.ts)
export const setPixelModeAtom = setPixelModeBaseAtom

// ============================================================================
// PRESETS
// ============================================================================

export const TARGET_DIMENSION_PRESETS = {
  mode0: [
    { name: 'Standard', width: 160, height: 200 },
    { name: 'Overscan', width: 192, height: 280 }
  ],
  mode1: [
    { name: 'Standard', width: 320, height: 200 },
    { name: 'Overscan', width: 384, height: 280 }
  ],
  mode2: [
    { name: 'Standard', width: 640, height: 200 },
    { name: 'Overscan', width: 768, height: 280 }
  ]
} as const
