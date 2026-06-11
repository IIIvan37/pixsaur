import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { countLockedEmptySlots, extractLockedColors } from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { reducePalette } from '@/palette/application/reduce-palette'
import { effectiveModeConfigAtom } from '../config/config'
import type { PaletteSlot } from './types'

// Type pour la sérialisation JSON (les tuples deviennent des arrays)
type SerializedPaletteSlot = {
  color: [number, number, number] | null
  locked: boolean
}

// comparaison superficielle pour les slots
function shallowEqualPalette(a: PaletteSlot[], b: PaletteSlot[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((slot, i) => {
    const other = b[i]
    return (
      slot.locked === other.locked &&
      slot.color?.[0] === other.color?.[0] &&
      slot.color?.[1] === other.color?.[1] &&
      slot.color?.[2] === other.color?.[2]
    )
  })
}

// Stocke uniquement les verrous : index -> vecteur RGB
export const lockedSlotsAtom = atom<Record<number, Vector<'RGB'>>>({})

// Valeur par defaut pour la palette
const defaultPalette: SerializedPaletteSlot[] = new Array(16)
  .fill(null)
  .map(() => ({
    color: null,
    locked: false
  }))

// Atom de stockage persistant dans localStorage
const paletteStorageAtom = atomWithStorage<SerializedPaletteSlot[]>(
  'pixsaur-palette-slots',
  defaultPalette
)

// L'atome principal, mutable, qui contiendra vos 16 slots
// Synchronise avec le localStorage via paletteStorageAtom
export const userPaletteAtom = atom(
  (get) => {
    const stored = get(paletteStorageAtom)
    // Convertir les arrays en tuples Vector<'RGB'>
    return stored.map((slot) => ({
      color: slot.color as Vector<'RGB'> | null,
      locked: slot.locked
    })) as PaletteSlot[]
  },
  (get, set, newValue: PaletteSlot[]) => {
    const prev = get(paletteStorageAtom)
    // Convertir pour la comparaison
    const prevPalette = prev.map((slot) => ({
      color: slot.color as Vector<'RGB'> | null,
      locked: slot.locked
    })) as PaletteSlot[]

    // Utiliser la comparaison superficielle pour eviter les mises a jour inutiles
    if (!shallowEqualPalette(prevPalette, newValue)) {
      set(paletteStorageAtom, newValue as SerializedPaletteSlot[])
    }
  }
)

// Thin adapter over the `reducePalette` use-case
// (`@/palette/application/reduce-palette`): assembles the input from atoms and
// delegates the locked-slot-aware rebuild. The write guard in `userPaletteAtom`
// skips a no-op storage update, so no change-detection is needed here.
export const setReducedPaletteAtom = atom(
  null,
  (get, set, reduced: Vector<'RGB'>[]) => {
    const prev = get(userPaletteAtom)
    const maxColors = get(effectiveModeConfigAtom).nColors
    set(userPaletteAtom, reducePalette({ reduced, prev, maxColors }))
  }
)

// Bascule simplement le locked sur le slot idx
export const onToggleLockAtom = atom(null, (get, set, idx: number) => {
  const slots = [...get(userPaletteAtom)]
  slots[idx] = { ...slots[idx], locked: !slots[idx].locked }
  set(userPaletteAtom, slots)
})

// Pose une couleur depuis le popover et lock
export const onSetColorAtom = atom(null, (get, set, { index, color }) => {
  const slots = [...get(userPaletteAtom)]
  slots[index] = { color: color.vector, locked: true }
  set(userPaletteAtom, slots)
})

// Vide un slot et le verrouille (pour limiter le nombre de couleurs)
export const onClearSlotAtom = atom(null, (get, set, idx: number) => {
  const slots = [...get(userPaletteAtom)]
  slots[idx] = { color: null, locked: true }
  set(userPaletteAtom, slots)
})

export const lockedVectorsAtom = atom((get) => {
  const { nColors } = get(effectiveModeConfigAtom)
  return extractLockedColors(
    get(userPaletteAtom).slice(0, nColors)
  ) as Vector<'RGB'>[]
})

// Compte le nombre de slots vides verrouilles (pour reduire le nombre de couleurs a generer)
export const lockedEmptySlotsCountAtom = atom((get) => {
  const { nColors } = get(effectiveModeConfigAtom)
  return countLockedEmptySlots(get(userPaletteAtom), nColors)
})
