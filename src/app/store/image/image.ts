import { atom } from 'jotai'
import {
  downscaleImage,
  Selection
} from '@/libs/pixsaur-adapter/io/downscale-image'

const srcAtom = atom<ImageData | null>(null)

// Atomes de base
export const imageAtom = atom<HTMLImageElement | null>(null)

export const canvasWidthAtom = atom<number | null>(null)

export const canvasSizeAtom = atom((get) => {
  const img = get(imageAtom)
  const width = get(canvasWidthAtom)

  if (!img || !width) return { width: 0, height: 0 }
  const height = Math.floor((img.height / img.width) * width)
  return {
    width,
    height
  }
})

export const setImgAtom = atom(
  null,
  (_get, set, img: HTMLImageElement | null) => {
    set(imageAtom, img)
  }
)
export const downscaledAtom = atom((get) => {
  const img = get(imageAtom)
  const { width, height } = get(canvasSizeAtom)
  if (!img || !width || !height) return null
  return downscaleImage(img, width)
})

export const workingImageAtom = atom((get) => {
  const downscaled = get(downscaledAtom)
  const src = get(srcAtom)

  if (src) {
    return src
  } else {
    if (!downscaled) return null
    return new ImageData(
      new Uint8ClampedArray(downscaled.data),
      downscaled.width,
      downscaled.height
    )
  }
})

export const setWorkingImageAtom = atom(
  null,
  (_get, set, img: ImageData | null) => {
    set(srcAtom, img)
  }
)

// Version de src pour invalidation des hooks
export const srcVersionAtom = atom(0)

export const setSelectionAtom = atom(
  null,
  (_get, set, selection: Selection | null) => {
    set(selectionAtom, selection)
  }
)

export const setCanvasWidth = atom(null, (_get, set, width: number) => {
  set(canvasWidthAtom, width)
})

export const initialSelectionAtom = atom((get) => {
  const downscaled = get(downscaledAtom)
  if (!downscaled) return null

  return {
    sx: 0,
    sy: 0,
    width: downscaled.width,
    height: downscaled.height
  }
})

export const selectionAtom = atom(
  (get) => get(_selectionWritableAtom) ?? get(initialSelectionAtom),
  (_get, set, newSel: Selection | null) => set(_selectionWritableAtom, newSel)
)

const _selectionWritableAtom = atom<Selection | null>(null)
