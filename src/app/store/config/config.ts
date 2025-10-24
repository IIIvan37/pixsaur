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
import type { ResizeMode } from './resize-types'

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

// Setter for resize mode
export const setResizeModeAtom = atom(
  null,
  (_get, set, payload: ResizeMode) => {
    set(resizeModeAtom, payload)
  }
)

// Center image in target (when image is smaller than target dimensions)
export const centerImageAtom = atom<boolean>(true)
