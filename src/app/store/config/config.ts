import { atom } from 'jotai'
import type { DitheringConfig } from '@/libs/pixsaur-color/src'
import type { ColorSpace } from '@/libs/pixsaur-color/src/type'
import { CPCHardware } from '@/libs/types'
import { userPaletteAtom } from '../palette/palette'
import type { PaletteSlot } from '../palette/types'
import type {
  AdjustementKey,
  ContrastStrategy,
  CpcModeKey,
  ProcessorType
} from './types'
import type { ResizeMode, CPCMode } from './resize-types'
import {
  validateCPCMemory,
  validateWidthForMode,
  validateHeight,
  getDefaultTargetSize
} from './resize-types'

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
export const modeAtom = atom<CpcModeKey>('0')
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

// Processor type selection (auto, cpu, gpu) - GPU par défaut pour de meilleures performances
export const processorTypeAtom = atom<ProcessorType>('gpu')

// Setter for processor type
export const setProcessorTypeAtom = atom(
  null,
  (_get, set, payload: ProcessorType) => {
    set(processorTypeAtom, payload)
  }
)

// Contrast strategy selection for small palettes (modes 1-2)
export const contrastStrategyAtom = atom<ContrastStrategy>('balanced')

// Setter for contrast strategy
export const setContrastStrategyAtom = atom(
  null,
  (_get, set, payload: ContrastStrategy) => {
    set(contrastStrategyAtom, payload)
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

// Target dimensions atoms (updated when mode or CPC mode changes)
export const targetWidthAtom = atom<number>(160)
export const targetHeightAtom = atom<number>(200)

// Derived atom: Initialize target dimensions based on CPC mode
export const defaultTargetDimensionsAtom = atom((get) => {
  const cpcMode = get(modeAtom)
  const numericMode = Number.parseInt(cpcMode, 10) as CPCMode
  return getDefaultTargetSize(numericMode)
})

// Setter for resize mode with dimension reset
export const setResizeModeAtom = atom(
  null,
  (get, set, payload: ResizeMode) => {
    set(resizeModeAtom, payload)
    
    // Reset to default dimensions when changing mode
    if (payload !== 'userSize') {
      const defaults = get(defaultTargetDimensionsAtom)
      set(targetWidthAtom, defaults.width)
      set(targetHeightAtom, defaults.height)
    }
  }
)

// Setter for target width with validation
export const setTargetWidthAtom = atom(
  null,
  (get, set, payload: number) => {
    const cpcMode = get(modeAtom)
    const numericMode = Number.parseInt(cpcMode, 10) as CPCMode
    const validation = validateWidthForMode(payload, numericMode)
    
    // Always set the value, UI will show validation error
    set(targetWidthAtom, payload)
    
    return validation
  }
)

// Setter for target height with validation
export const setTargetHeightAtom = atom(
  null,
  (_get, set, payload: number) => {
    const validation = validateHeight(payload)
    
    // Always set the value, UI will show validation error
    set(targetHeightAtom, payload)
    
    return validation
  }
)

// Derived atom: Real-time memory validation
export const memoryValidationAtom = atom((get) => {
  const width = get(targetWidthAtom)
  const height = get(targetHeightAtom)
  const cpcMode = get(modeAtom)
  const numericMode = Number.parseInt(cpcMode, 10) as CPCMode
  
  return validateCPCMemory(width, height, numericMode)
})

// Derived atom: Complete validation state
export const resizeValidationAtom = atom((get) => {
  const width = get(targetWidthAtom)
  const height = get(targetHeightAtom)
  const cpcMode = get(modeAtom)
  const numericMode = Number.parseInt(cpcMode, 10) as CPCMode
  
  const widthValidation = validateWidthForMode(width, numericMode)
  const heightValidation = validateHeight(height)
  const memoryValidation = get(memoryValidationAtom)
  
  return {
    width: widthValidation,
    height: heightValidation,
    memory: memoryValidation,
    isValid: widthValidation.valid && heightValidation.valid && memoryValidation.valid
  }
})
