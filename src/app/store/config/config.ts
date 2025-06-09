import { DitheringConfig } from '@/libs/pixsaur-color/src'
import { ColorSpace } from '@/libs/pixsaur-color/src/type'
import { atom } from 'jotai'
import { AdjustementKey, CpcModeKey } from './types'

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
