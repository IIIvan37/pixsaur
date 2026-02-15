/**
 * Configuration Module
 *
 * This module re-exports all configuration atoms from their dedicated modules.
 * Maintained for backward compatibility - new code should import from specific modules.
 *
 * Architecture (ISP - Interface Segregation Principle):
 * - adjustments.ts: Image color/tone adjustments
 * - dimensions.ts: Pixel mode + dimension management
 * - dithering.ts: Dithering and color space
 * - processing.ts: Processor, palette strategy, smoothing
 * - hardware.ts: CPC hardware selection
 * - mode-r.ts: Mode R configuration
 * - egx.ts: EGX mode configuration
 * - resize.ts: Resize mode settings
 */

import { atom } from 'jotai'
import { getWidthStepForMode } from '@/export'
import { rasterEnabledAtom } from '../raster/raster-config'
import {
  customDimensionsAtom as customDimensionsAtomImport,
  dimensionPresetAtom as dimensionPresetAtomImport,
  effectiveModeConfigAtom as effectiveModeConfigAtomImport,
  pixelModeAtom as pixelModeAtomImport
} from './dimensions'
import { ditheringAtom as ditheringAtomImport } from './dithering'
import { egxEnabledAtom, egxTypeAtom } from './egx'
import { modeREnabledAtom } from './mode-r'
import { autoDistinctMappingAtom as autoDistinctMappingAtomImport } from './processing'

// ============================================================================
// RE-EXPORTS FROM MODULES
// ============================================================================

// Adjustments
export {
  adjustmentsAtom,
  clearLastChangedKeyAtom,
  configAtom,
  resetAdjustmentsAtom,
  resetImageAdjustmentsAtom,
  setAdjustmentAtom,
  setChromaKeyColorAtom,
  setComponentAtom
} from './adjustments'

// Dimensions (base exports)
export {
  customDimensionsAtom,
  derivedModeAtom,
  dimensionPresetAtom,
  effectiveModeConfigAtom,
  modeAtom,
  pixelModeAtom,
  setCustomDimensionsAtom,
  setModeAtom,
  TARGET_DIMENSION_PRESETS
} from './dimensions'

// Dithering
export {
  colorSpaceAtom,
  ditheringAtom,
  setColorSpaceAtom,
  setDitheringAtom,
  switchToRasterCompatibleDitheringAtom
} from './dithering'
export type { EGXFirstLineMode, EGXPreviewMode, EGXType, EgxType } from './egx'
// EGX (base exports)
export {
  egxEnabledAtom,
  egxFirstLineModeAtom,
  egxModesPairAtom,
  egxOverscanAtom,
  egxPreviewModeAtom,
  egxTypeAtom,
  resetEgxAtom,
  setEgxFirstLineModeAtom,
  setEgxOverscanAtom,
  setEgxPreviewModeAtom
} from './egx'
// Hardware
export { cpcHardwareAtom, setCpcHardwareAtom } from './hardware'
export type {
  ModeRPixelMode,
  ModeRPreviewMode
} from './mode-r'
// Mode R
export {
  modeRAntiFlickerAtom,
  modeRDualPaletteAtom,
  modeREnabledAtom,
  modeRMaxLuminanceDeltaAtom,
  modeRPreviewModeAtom,
  resetModeRAtom,
  setModeRAntiFlickerAtom,
  setModeRDualPaletteAtom,
  setModeRMaxLuminanceDeltaAtom,
  setModeRPreviewModeAtom
} from './mode-r'
// Processing
export {
  autoDistinctMappingAtom,
  colorDiversityAtom,
  horizontalSmoothingAtom,
  paletteStrategyAtom,
  processorTypeAtom,
  setColorDiversityAtom,
  setPaletteStrategyAtom,
  setProcessorTypeAtom,
  smoothingAtom
} from './processing'
// Resize
export { centerImageAtom, resizeModeAtom, setResizeModeAtom } from './resize'

export type { ResizeMode } from './resize-types'
// Types re-export for convenience
export type {
  AdjustementKey,
  CpcModeConfig,
  CpcModeKey,
  CustomDimensions,
  DimensionPreset,
  PaletteStrategy,
  PixelMode,
  ProcessorType
} from './types'
export {
  buildCpcModeKey,
  buildCustomModeConfig,
  CPC_MODE_CONFIG,
  parseCpcModeKey
} from './types'

// ============================================================================
// MUTUAL EXCLUSION SETTERS
// These setters handle the mutual exclusion between special modes:
// Mode R, EGX, Raster, and Auto Distinct-Mapping are mutually exclusive
// ============================================================================

/**
 * Setter for Mode R enabled state with mutual exclusion
 * Disables EGX, Raster, and distinct-mapping when enabling Mode R
 */
export const setModeREnabledAtom = atom(null, (get, set, payload: boolean) => {
  if (payload) {
    if (get(egxEnabledAtom)) {
      set(egxEnabledAtom, false)
    }
    if (get(rasterEnabledAtom)) {
      set(rasterEnabledAtom, false)
    }
    if (get(autoDistinctMappingAtomImport)) {
      set(autoDistinctMappingAtomImport, false)
    }
  }
  set(modeREnabledAtom, payload)
})

/**
 * Setter for EGX enabled state with mutual exclusion
 * Disables Mode R and Raster when enabling EGX
 * Also sets the appropriate pixel mode:
 * - EGX1 requires Mode 0 (16 colors)
 * - EGX2 requires Mode 1 (4 colors)
 */
export const setEgxEnabledAtom = atom(null, (get, set, payload: boolean) => {
  if (payload) {
    if (get(modeREnabledAtom)) {
      set(modeREnabledAtom, false)
    }
    if (get(rasterEnabledAtom)) {
      set(rasterEnabledAtom, false)
    }
    if (get(autoDistinctMappingAtomImport)) {
      set(autoDistinctMappingAtomImport, false)
    }
    // Set the appropriate pixel mode for the current EGX type
    const egxType = get(egxTypeAtom)
    const requiredMode = egxType === 'egx1' ? 0 : 1
    set(pixelModeAtomImport, requiredMode)
  }
  set(egxEnabledAtom, payload)
})

/**
 * Setter for EGX type with automatic pixel mode adjustment
 * - EGX1 requires Mode 0 (16 colors)
 * - EGX2 requires Mode 1 (4 colors)
 */
export const setEgxTypeAtom = atom(
  null,
  (get, set, payload: 'egx1' | 'egx2') => {
    set(egxTypeAtom, payload)
    // If EGX is enabled, update the pixel mode accordingly
    if (get(egxEnabledAtom)) {
      const requiredMode = payload === 'egx1' ? 0 : 1
      set(pixelModeAtomImport, requiredMode)
    }
  }
)

/**
 * Setter for Raster enabled state with mutual exclusion
 * Disables Mode R and EGX when enabling Raster
 * Also switches to a compatible dithering mode if current mode uses error diffusion
 */
export const setRasterEnabledAtom = atom(null, (get, set, payload: boolean) => {
  if (payload) {
    if (get(modeREnabledAtom)) {
      set(modeREnabledAtom, false)
    }
    if (get(egxEnabledAtom)) {
      set(egxEnabledAtom, false)
    }
    if (get(autoDistinctMappingAtomImport)) {
      set(autoDistinctMappingAtomImport, false)
    }

    // Switch to compatible dithering mode if current mode uses error diffusion
    const currentDithering = get(ditheringAtomImport)
    const errorDiffusionModes = [
      'floydSteinberg',
      'atkinson',
      'ylioluma1',
      'ylioluma2'
    ]
    if (
      currentDithering.mode !== 'none' &&
      errorDiffusionModes.includes(currentDithering.mode)
    ) {
      set(ditheringAtomImport, {
        mode: 'bayer2x2',
        intensity: 0.25
      })
    }
  }
  set(rasterEnabledAtom, payload)
})

/**
 * Setter for auto distinct-mapping with mutual exclusion
 * Disables Mode R, EGX, and Raster when enabling distinct-mapping
 */
export const setAutoDistinctMappingAtom = atom(
  null,
  (get, set, payload: boolean) => {
    if (payload) {
      if (get(modeREnabledAtom)) {
        set(modeREnabledAtom, false)
      }
      if (get(egxEnabledAtom)) {
        set(egxEnabledAtom, false)
      }
      if (get(rasterEnabledAtom)) {
        set(rasterEnabledAtom, false)
      }
    }
    set(autoDistinctMappingAtomImport, payload)
  }
)

/**
 * Setter for pixel mode with EGX constraint handling
 * When EGX is enabled, forces the required mode for the EGX type
 * Also adjusts custom dimensions width to maintain byte count
 */
export const setPixelModeAtom = atom(null, (get, set, payload: 0 | 1 | 2) => {
  const egxEnabled = get(egxEnabledAtom)
  const dimensionPreset = get(dimensionPresetAtomImport)
  const previousMode = get(pixelModeAtomImport)

  // If EGX is enabled, force the required mode
  let effectivePayload = payload
  if (egxEnabled) {
    const egxType = get(egxTypeAtom)
    effectivePayload = egxType === 'egx1' ? 0 : 1
  }

  set(pixelModeAtomImport, effectivePayload)

  // Adjust custom dimensions width when mode changes
  if (dimensionPreset === 'custom' && previousMode !== effectivePayload) {
    const currentDimensions = get(customDimensionsAtomImport)
    const currentWidth = currentDimensions.width

    const currentPixelsPerByte = getWidthStepForMode(previousMode)
    const byteWidth = currentWidth / currentPixelsPerByte

    const newPixelsPerByte = getWidthStepForMode(effectivePayload)
    const newWidth = byteWidth * newPixelsPerByte

    const widthStep = getWidthStepForMode(effectivePayload)
    const adjustedWidth = Math.round(newWidth / widthStep) * widthStep
    const finalWidth = Math.max(4, Math.min(768, adjustedWidth))

    set(customDimensionsAtomImport, {
      ...currentDimensions,
      width: finalWidth
    })
  }
})

/**
 * Setter for dimension preset
 * Inherits current effective dimensions when switching to custom
 */
export const setDimensionPresetAtom = atom(
  null,
  (get, set, payload: 'standard' | 'overscan' | 'custom') => {
    const currentPreset = get(dimensionPresetAtomImport)

    if (payload === 'custom' && currentPreset !== 'custom') {
      const currentConfig = get(effectiveModeConfigAtomImport)
      set(customDimensionsAtomImport, {
        width: currentConfig.width,
        height: currentConfig.height
      })
    }

    set(dimensionPresetAtomImport, payload)
  }
)
