import { atom } from 'jotai'
import { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'

// Atomes de base
export const srcAtom = atom<ImageData | null>(null)
export const downscaledAtom = atom<ImageData | null>(null)
export const selectionAtom = atom<Selection | null>(null)

// Version de src pour invalidation des hooks
export const srcVersionAtom = atom(0)

// Action combinée
export const setDownscaledAtom = atom(
  null,
  (get, set, img: ImageData | null) => {
    set(downscaledAtom, img)
    set(srcAtom, img)
    set(srcVersionAtom, get(srcVersionAtom) + 1)

    if (img) {
      set(selectionAtom, {
        sx: 0,
        sy: 0,
        width: img.width,
        height: img.height
      })
    } else {
      set(selectionAtom, null)
    }
  }
)

// Setter direct de src
export const setSrcAtom = atom(null, (get, set, img: ImageData | null) => {
  set(srcAtom, img)
  set(srcVersionAtom, get(srcVersionAtom) + 1)
})

export const setSelectionAtom = atom(
  null,
  (_get, set, selection: Selection | null) => {
    set(selectionAtom, selection)
  }
)
