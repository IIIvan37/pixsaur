import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { logger } from '@/core/logger'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { effectiveModeConfigAtom } from '../config/config'
import type { PaletteSlot } from './types'

// Type pour la sérialisation JSON (les tuples deviennent des arrays)
type SerializedPaletteSlot = {
  color: [number, number, number] | null
  locked: boolean
}

// Utilitaire: compare deux vecteurs RGB
function vectorsEqual(a: Vector<'RGB'>, b: Vector<'RGB'>): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

// Utilitaire: filtre les slots dans la limite du mode
function slotsWithinModeLimit(
  slots: PaletteSlot[],
  maxColors: number
): PaletteSlot[] {
  return slots.filter((_, i) => i < maxColors)
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

export const setReducedPaletteAtom = atom(
  null,
  (get, set, reduced: Vector<'RGB'>[]) => {
    const prev = get(userPaletteAtom)
    const modeConfig = get(effectiveModeConfigAtom)
    const maxColors = modeConfig.nColors

    logger.info('[Palette] setReducedPaletteAtom called', {
      reducedLength: reduced.length,
      maxColors,
      prevLockedSlots: prev
        .slice(0, maxColors)
        .map((s, i) => ({ i, locked: s.locked, hasColor: !!s.color }))
        .filter((s) => s.locked)
    })

    // 2.1 - extraire les vecteurs des slots lockes
    const lockedVecs = prev
      .filter((slot) => slot.locked && slot.color)
      .map((slot) => slot.color!) // Vector<'RGB'>[]

    // 2.2 - filtrer reduced pour oter toute couleur deja lockee
    const queue = reduced.filter(
      (vec) => !lockedVecs.some((lv) => vectorsEqual(lv, vec))
    )

    // 2.3 - reconstruire la nouvelle palette (limiter a maxColors)
    const newSlots: PaletteSlot[] = []
    for (let i = 0; i < maxColors; i++) {
      if (prev[i]?.locked) {
        // on conserve strictement le slot locke
        newSlots[i] = { ...prev[i] }
      } else {
        // sinon on pioche dans la file filtree
        const vec = queue.shift() ?? null
        newSlots[i] = { color: vec, locked: false }
      }
    }

    logger.info('[Palette] New slots after reconstruction', {
      queueRemaining: queue.length,
      newSlots: newSlots.map((s, i) => ({
        i,
        locked: s.locked,
        hasColor: !!s.color
      }))
    })

    // Completer avec des slots vides pour atteindre 16
    // Preserver l'etat verrouille des slots existants hors du mode actuel
    while (newSlots.length < 16) {
      const idx = newSlots.length
      const existingSlot = prev[idx]
      // Conserver le locked mais effacer la couleur (hors mode actuel)
      newSlots.push({ color: null, locked: existingSlot?.locked ?? false })
    }

    set(userPaletteAtom, newSlots)
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
  const modeConfig = get(effectiveModeConfigAtom)
  const slots = slotsWithinModeLimit(get(userPaletteAtom), modeConfig.nColors)
  return slots
    .filter((slot) => slot.locked && slot.color !== null)
    .map((slot) => slot.color) as Vector<'RGB'>[]
})

// Compte le nombre de slots vides verrouilles (pour reduire le nombre de couleurs a generer)
export const lockedEmptySlotsCountAtom = atom((get) => {
  const modeConfig = get(effectiveModeConfigAtom)
  const slots = slotsWithinModeLimit(get(userPaletteAtom), modeConfig.nColors)
  return slots.filter((slot) => slot.locked && slot.color === null).length
})
