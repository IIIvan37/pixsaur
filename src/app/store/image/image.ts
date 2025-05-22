import { atom } from 'jotai'
import {
  downscaleImage,
  Selection
} from '@/libs/pixsaur-adapter/io/downscale-image'

// Atomes de base
export const imageAtom = atom<HTMLImageElement | null>(null)
export const srcAtom = atom<ImageData | null>(null)
export const selectionAtom = atom<Selection | null>(null)
export const canvasWidthAtom = atom<number | null>(null)

export const canvasSizeAtom = atom((get) => {
  const img = get(srcAtom)
  const width = get(canvasWidthAtom)
  console.log('canvasSizeAtom', width)
  if (!img || !width) return null
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
    if (img) {
      const imageData = new ImageData(img.width, img.height)
      set(srcAtom, imageData)
      set(selectionAtom, { sx: 0, sy: 0, width: img.width, height: img.height })
    } else {
      set(srcAtom, null)
      set(selectionAtom, null)
    }
  }
)
export const downscaledAtom = atom((get) => {
  const img = get(imageAtom)
  const size = get(canvasSizeAtom)
  if (!img || !size) return null
  return downscaleImage(img, size.width)
})

// Version de src pour invalidation des hooks
export const srcVersionAtom = atom(0)

export const setSelectionAtom = atom(
  null,
  (_get, set, selection: Selection | null) => {
    set(selectionAtom, selection)
  }
)

export const setSrcAtom = atom(null, (get, set, src: ImageData | null) => {
  set(srcAtom, src)
})

export const setCanvasWidth = atom(null, (get, set, width: number) => {
  console.log('setCanvasWidth', width)
  set(canvasWidthAtom, width)
})
