import { atom } from 'jotai'
import type { DitheringConfig } from '@/libs/pixsaur-color/src'
import type { ColorSpace } from '@/libs/pixsaur-color/src/type'
import { CPCHardware } from '@/libs/types'
import { getWidthStepForMode } from '@/utils/cpc-calculations'
import { userPaletteAtom } from '../palette/palette'
import type { PaletteSlot } from '../palette/types'
import type { ResizeMode } from './resize-types'
import type {
  AdjustementKey,
  CpcModeConfig,
  CpcModeKey,
  CustomDimensions,
  DimensionPreset,
  PaletteStrategy,
  PixelMode,
  ProcessorType
} from './types'
import {
  buildCpcModeKey,
  buildCustomModeConfig,
  CPC_MODE_CONFIG,
  parseCpcModeKey
} from './types'

// Valeurs par défaut (facteurs multiplicatifs)
const defaultConfig: { [key in AdjustementKey]: number } & {
  lastChangedKey: AdjustementKey | null
} = {
  red: 1,
  green: 1,
  blue: 1,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0, // -180 à +180 degrés
  vibrance: 0, // -100 à +100
  temperature: 0, // -100 à +100 (bleu/orange)
  tint: 0, // -100 à +100 (vert/magenta)
  gamma: 1, // 0.1 à 3.0
  exposure: 0, // -3 à +3 stops
  highlights: 0, // -100 à +100
  shadows: 0, // -100 à +100
  posterization: 256,
  lastChangedKey: null
}

// Atom principal des réglages
export const configAtom = atom<typeof defaultConfig>({ ...defaultConfig })

// Setter pour un seul réglage (red, green, etc.)
export const setComponentAtom = atom(
  null,
  (get, set, payload: { key: AdjustementKey; value: number }) => {
    const prev = get(configAtom)
    set(configAtom, {
      ...prev,
      [payload.key]: payload.value,
      lastChangedKey: payload.key
    })
  }
)

// Réinitialise uniquement la clé de changement
export const clearLastChangedKeyAtom = atom(null, (_get, set) => {
  set(configAtom, (prev) => ({ ...prev, lastChangedKey: null }))
})

// Réinitialisation complète explicite
export const resetImageAdjustmentsAtom = atom(null, (_get, set) => {
  set(configAtom, { ...defaultConfig })
})

// Atoms pour les autres paramètres de conversion
// Legacy atom - will be deprecated in favor of separate pixelModeAtom + dimensionPresetAtom
export const modeAtom = atom<CpcModeKey>('0')

// ============================================================================
// NEW: SEPARATED PIXEL MODE AND DIMENSION PRESET
// ============================================================================

// Pixel mode atom - controls pixel aspect ratio (0, 1, or 2)
export const pixelModeAtom = atom<PixelMode>(0)

// Dimension preset atom - controls dimensions (standard, overscan, or custom)
export const dimensionPresetAtom = atom<DimensionPreset>('standard')

// Custom dimensions atom - only used when dimensionPreset is 'custom'
export const customDimensionsAtom = atom<CustomDimensions>({
  width: 160,
  height: 200
})

// Derived atom that combines pixelMode + dimensionPreset into legacy CpcModeKey
// For 'custom' preset, returns the base mode ('0', '1', or '2')
// This maintains backward compatibility with existing code
export const derivedModeAtom = atom(
  (get) => {
    const pixelMode = get(pixelModeAtom)
    const dimensionPreset = get(dimensionPresetAtom)

    // For custom dimensions, return base mode key
    if (dimensionPreset === 'custom') {
      return pixelMode.toString() as CpcModeKey
    }

    return buildCpcModeKey(pixelMode, dimensionPreset)
  },
  (_get, set, payload: CpcModeKey) => {
    // When setting the derived mode, update both atoms
    const { pixelMode, dimensionPreset } = parseCpcModeKey(payload)
    set(pixelModeAtom, pixelMode)
    set(dimensionPresetAtom, dimensionPreset)
  }
)

// Setter for pixel mode only
// When in custom dimensions mode, adjusts width to maintain same byte count
export const setPixelModeAtom = atom(null, (get, set, payload: PixelMode) => {
  const dimensionPreset = get(dimensionPresetAtom)
  const previousMode = get(pixelModeAtom)

  set(pixelModeAtom, payload)

  // If in custom mode and mode changed, adjust width to keep same byte count
  if (dimensionPreset === 'custom' && previousMode !== payload) {
    const currentDimensions = get(customDimensionsAtom)
    const currentWidth = currentDimensions.width

    // Calculate current byte width
    const currentPixelsPerByte = getWidthStepForMode(previousMode)
    const byteWidth = currentWidth / currentPixelsPerByte

    // Calculate new pixel width for same byte count
    const newPixelsPerByte = getWidthStepForMode(payload)
    const newWidth = byteWidth * newPixelsPerByte

    // Round to nearest valid step
    const widthStep = getWidthStepForMode(payload)
    const adjustedWidth = Math.round(newWidth / widthStep) * widthStep

    // Clamp to valid range
    const finalWidth = Math.max(4, Math.min(768, adjustedWidth))

    set(customDimensionsAtom, {
      ...currentDimensions,
      width: finalWidth
    })
  }
})

// Setter for dimension preset only
// When switching to 'custom', inherit current effective dimensions
export const setDimensionPresetAtom = atom(
  null,
  (get, set, payload: DimensionPreset) => {
    const currentPreset = get(dimensionPresetAtom)

    // If switching TO custom mode, inherit current dimensions
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

// Setter for custom dimensions
export const setCustomDimensionsAtom = atom(
  null,
  (_get, set, payload: CustomDimensions) => {
    set(customDimensionsAtom, payload)
  }
)

// Derived atom that returns the complete CPC mode configuration
// Handles custom dimensions when dimensionPreset is 'custom'
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
// COLOR SPACE AND DITHERING
// ============================================================================

export const colorSpaceAtom = atom<ColorSpace>('RGB')
export const ditheringAtom = atom<DitheringConfig>({
  mode: 'floydSteinberg',
  intensity: 0.5
})

// Setter partiel pour le dithering
export const setDitheringAtom = atom(
  null,
  (get, set, payload: Partial<DitheringConfig>) => {
    const prev = get(ditheringAtom)
    set(ditheringAtom, { ...prev, ...payload })
  }
)

// Setter du mode CPC avec merge des réglages
export const setModeAtom = atom(null, (get, set, payload: CpcModeKey) => {
  const prev = get(modeAtom)
  set(modeAtom, payload)
  if (prev !== payload) {
    set(configAtom, (prevConfig) => ({
      ...defaultConfig,
      ...prevConfig,
      lastChangedKey: null
    }))
  }
})

// Setter de l’espace couleur avec merge des réglages
export const setColorSpaceAtom = atom(null, (get, set, payload: ColorSpace) => {
  const prev = get(colorSpaceAtom)
  set(colorSpaceAtom, payload)
  if (prev !== payload) {
    set(configAtom, (prevConfig) => ({
      ...defaultConfig,
      ...prevConfig,
      lastChangedKey: null
    }))
  }
})

export const smoothingAtom = atom<boolean>(true)

// Horizontal smoothing (anti-aliasing) for CPC pixel modes
export const horizontalSmoothingAtom = atom<boolean>(false)

// Processor type selection (auto, cpu, gpu) - GPU par défaut pour de meilleures performances
export const processorTypeAtom = atom<ProcessorType>('gpu')

// Setter for processor type
export const setProcessorTypeAtom = atom(
  null,
  (_get, set, payload: ProcessorType) => {
    set(processorTypeAtom, payload)
  }
)

// Palette strategy selection for color quantization
export const paletteStrategyAtom = atom<PaletteStrategy>('frequency-balanced')

// Setter for palette strategy
export const setPaletteStrategyAtom = atom(
  null,
  (_get, set, payload: PaletteStrategy) => {
    set(paletteStrategyAtom, payload)
  }
)

// CPC Hardware selection atom
export const cpcHardwareAtom = atom<CPCHardware>(CPCHardware.CLASSIC)

// Setter for CPC Hardware
export const setCpcHardwareAtom = atom(
  null,
  (get, set, payload: CPCHardware) => {
    const current = get(cpcHardwareAtom)

    // Débloquer toutes les couleurs lors de tout changement de mode CPC
    // Cela garantit la cohérence : Classic ↔ Plus = couleurs débloquées
    if (current !== payload) {
      const currentPalette = get(userPaletteAtom)
      const unlockedPalette = currentPalette.map((slot: PaletteSlot) => ({
        ...slot,
        locked: false
      }))
      set(userPaletteAtom, unlockedPalette)
    }

    set(cpcHardwareAtom, payload)
  }
)

// ============================================================================
// RESIZE CONFIGURATION
// ============================================================================

// Resize mode selection (auto is the smart default with CPC aspect ratio correction)
export const resizeModeAtom = atom<ResizeMode>('auto')

// Setter for resize mode
export const setResizeModeAtom = atom(
  null,
  (_get, set, payload: ResizeMode) => {
    set(resizeModeAtom, payload)
  }
)

// Center image in target (when image is smaller than target dimensions)
export const centerImageAtom = atom<boolean>(true)

// ============================================================================
// DEPRECATED: TARGET DIMENSIONS
// ============================================================================
// Note: targetDimensionsAtom is OBSOLETE - not used in production code
// Use customDimensionsAtom (for custom mode) or effectiveModeConfigAtom instead
// This section remains only for backward compatibility and will be removed

// Preset dimensions for quick selection (Standard + Overscan only)
export const TARGET_DIMENSION_PRESETS = {
  mode0: [
    { name: 'Standard', width: 160, height: 200 }, // 80 bytes/line = 16Ko
    { name: 'Overscan', width: 192, height: 280 } // 96 bytes/line = 26.25Ko
  ],
  mode1: [
    { name: 'Standard', width: 320, height: 200 }, // 80 bytes/line = 16Ko
    { name: 'Overscan', width: 384, height: 280 } // 96 bytes/line = 26.25Ko
  ],
  mode2: [
    { name: 'Standard', width: 640, height: 200 }, // 80 bytes/line = 16Ko
    { name: 'Overscan', width: 768, height: 280 } // 96 bytes/line = 26.25Ko
  ]
} as const
