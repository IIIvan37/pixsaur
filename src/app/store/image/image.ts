import { atom } from 'jotai'
import {
  downscaleImage,
  type Selection
} from '@/libs/pixsaur-adapter/io/downscale-image'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import { configAtom } from '../config/config'

const LOGICAL_WIDTH = 400

// Atomes de base
export const imageAtom = atom<HTMLImageElement | null>(null)
export const canvasWidthAtom = atom<number | null>(null)

export const canvasSizeAtom = atom((get) => {
  const img = get(imageAtom)
  const width = get(canvasWidthAtom)
  if (!img || !width) return { width: 0, height: 0 }
  const height = Math.floor((img.height / img.width) * width)
  return { width, height }
})

const srcAtom = atom<ImageData | null>(null)
export const srcVersionAtom = atom(0)

// Setter principal
export const setImgAtom = atom(
  null,
  (_get, set, img: HTMLImageElement | null) => {
    set(imageAtom, img)
    set(srcAtom, null)
    set(srcVersionAtom, (v) => v + 1)
  }
)

export const downscaledAtom = atom((get) => {
  get(srcVersionAtom)
  const img = get(imageAtom)
  if (!img) return null
  return downscaleImage(img, LOGICAL_WIDTH)
})

export const workingImageAtom = atom((get) => {
  get(srcVersionAtom)
  const custom = get(srcAtom)
  const config = get(configAtom)
  const downscaled = get(downscaledAtom)

  if (!downscaled) return null
  if (custom) return custom

  return applyAdjustmentsInOnePass(downscaled, {
    rgb: { r: config.red, g: config.green, b: config.blue },
    brightness: config.brightness,
    contrast: config.contrast,
    saturation: config.saturation
  })
})

export const setWorkingImageAtom = atom(
  null,
  (_get, set, img: ImageData | null) => {
    set(srcAtom, img)
  }
)

export const setCanvasWidth = atom(null, (_get, set, width: number) => {
  set(canvasWidthAtom, width)
})

const _selectionWritableAtom = atom<Selection | null>(null)

export const selectionAtom = atom(
  (get) => get(_selectionWritableAtom) ?? get(initialSelectionAtom),
  (_get, set, newSel: Selection | null) => {
    set(_selectionWritableAtom, newSel)
  }
)

export const setSelectionAtom = atom(
  null,
  (_get, set, selection: Selection | null) => {
    set(selectionAtom, selection)
  }
)

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
