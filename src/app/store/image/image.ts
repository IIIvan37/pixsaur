import { atom } from 'jotai'
import { logger } from '@/core'
import {
  downscaleImage,
  type Selection
} from '@/libs/pixsaur-adapter/io/downscale-image'
import { imageProcessorAtom } from '../adapters/processors'
import { configAtom } from '../config/config'

const LOGICAL_WIDTH = 800

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

export const workingImageAtom = atom(async (get) => {
  logger.time('workingImageAtom')
  get(srcVersionAtom)
  const custom = get(srcAtom)
  const config = get(configAtom)
  const downscaled = get(downscaledAtom)
  const imageProcessor = get(imageProcessorAtom)

  if (!downscaled) {
    logger.timeEnd('workingImageAtom')
    return null
  }
  if (custom) {
    logger.timeEnd('workingImageAtom')
    return custom
  }

  if (!imageProcessor) {
    logger.timeEnd('workingImageAtom')
    return downscaled
  }

  logger.time('applyAdjustmentsSync')
  const result = imageProcessor.applyAdjustmentsSync(downscaled, {
    rgb: { r: config.red, g: config.green, b: config.blue },
    brightness: config.brightness,
    contrast: config.contrast,
    saturation: config.saturation,
    hue: config.hue,
    vibrance: config.vibrance,
    temperature: config.temperature,
    tint: config.tint,
    gamma: config.gamma,
    exposure: config.exposure,
    highlights: config.highlights,
    shadows: config.shadows,
    posterization: config.posterization,
    median: config.median,
    sharpen: config.sharpen,
    blur: config.blur,
    edges: config.edges,
    chromaKeyEnabled: config.chromaKeyEnabled,
    chromaKeyColor: config.chromaKeyColor,
    chromaKeyTolerance: config.chromaKeyTolerance
  })
  logger.timeEnd('applyAdjustmentsSync')

  logger.timeEnd('workingImageAtom')
  return result
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

/**
 * Atom to track if the user is currently dragging/resizing the selection rectangle.
 * Used to prevent expensive raster regeneration during active manipulation.
 */
export const isSelectionDraggingAtom = atom(false)

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

// Trigger to open the image file picker programmatically
export const openImagePickerAtom = atom(false)
export const setOpenImagePickerAtom = atom(null, (_get, set, open: boolean) => {
  set(openImagePickerAtom, open)
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
