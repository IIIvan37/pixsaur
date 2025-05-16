import { atom } from 'jotai'
import { atomWithCompare } from '../utils'
import { PaletteSlot } from './types'
import { Vector } from '@/libs/pixsaur-color/src/type'

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

// 1️⃣ Stocke uniquement les verrous : index → vecteur RGB
export const lockedSlotsAtom = atom<Record<number, Vector<'RGB'>>>({})

// 1️⃣ L’atome principal, mutable, qui contiendra vos 16 slots
export const userPaletteAtom = atomWithCompare<PaletteSlot[]>(
  Array(16).fill({ color: null as null | Vector<'RGB'>, locked: false }),
  shallowEqualPalette
)

export const setReducedPaletteAtom = atom(
  null,
  (get, set, reduced: Vector<'RGB'>[]) => {
    const prev = get(userPaletteAtom)

    // 2.1 – extraire les vecteurs des slots lockés
    const lockedVecs = prev
      .filter((slot) => slot.locked && slot.color)
      .map((slot) => slot.color!) // Vector<'RGB'>[]

    // 2.2 – filtrer reduced pour ôter toute couleur déjà lockée
    const queue = reduced.filter(
      (vec) => !lockedVecs.some((lv) => lv.every((c, i) => c === vec[i]))
    )

    // 2.3 – reconstruire la nouvelle palette
    const newSlots: PaletteSlot[] = []
    for (let i = 0; i < prev.length; i++) {
      if (prev[i].locked) {
        // on conserve strictement le slot locké
        newSlots[i] = { ...prev[i] }
      } else {
        // sinon on pioche dans la file filtrée
        const vec = queue.shift() ?? null
        newSlots[i] = { color: vec, locked: false }
      }
    }

    set(userPaletteAtom, newSlots)
  }
)

// 3️⃣ Bascule simplement le locked sur le slot idx
export const onToggleLockAtom = atom(null, (get, set, idx: number) => {
  const slots = [...get(userPaletteAtom)]
  slots[idx] = { ...slots[idx], locked: !slots[idx].locked }
  set(userPaletteAtom, slots)
})

// 4️⃣ Pose une couleur depuis le popover et lock
export const onSetColorAtom = atom(null, (get, set, { index, color }) => {
  const slots = [...get(userPaletteAtom)]
  slots[index] = { color: color.vector, locked: true }
  set(userPaletteAtom, slots)
})

export const lockedVectorsAtom = atom(
  (get) =>
    get(userPaletteAtom)
      .filter((slot) => slot.locked)
      .map((slot) => slot.color) as Vector<'RGB'>[]
)
