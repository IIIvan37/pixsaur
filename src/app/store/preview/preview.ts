import { extractBuffer, createQuantizer } from '@/libs/pixsaur-color/src'
import { Vector } from '@/libs/pixsaur-color/src/type'
import { getVisualRegion } from '@/utils/get-visual-region'
import { atom } from 'jotai'
import { modeAtom, colorSpaceAtom, ditheringAtom } from '../config/config'
import { CPC_MODE_CONFIG } from '../config/types'
import { selectionAtom, workingImageAtom } from '../image/image'
import { lockedVectorsAtom } from '../palette/palette'
import { remapImageDataToPalette } from '@/utils/exports/rgb-to-indexes'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { ColorSpaceDistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { getColorSpaceToRgbFn } from '@/libs/pixsaur-color/src/space'

export const previewCanvasWidthAtom = atom<number | null>(null)

export const previewCanvasSizeAtom = atom((get) => {
  const width = get(previewCanvasWidthAtom)
  if (!width) return { width: 0, height: 0 }
  const height = Math.floor(width * (200 / 320))
  return { width, height }
})

// 1. Zone sélectionnée réduite à la largeur du mode
export const croppedImageAtom = atom((get) => {
  const workingImageData = get(workingImageAtom)
  const selection = get(selectionAtom)
  const mode = get(modeAtom)

  if (!workingImageData || !selection) return null

  return getVisualRegion(workingImageData, selection, mode)
})

// 2. Extraction des données RGBA
export const croppedBufferAtom = atom((get) => {
  const cropped = get(croppedImageAtom)
  if (!cropped) return null
  return extractBuffer(cropped)
})

// 3. Construction du quantizer sans mémoïsation
export const quantizerAtom = atom((get) => {
  const buf = get(croppedBufferAtom)
  const cropped = get(croppedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = get(colorSpaceAtom)
  if (!buf || !cropped) return null

  const availableMetrics = ColorSpaceDistanceMetric[colorSpace]
  const distanceMetric = availableMetrics[0]

  return createQuantizer({
    buf,
    width: cropped.width,
    height: cropped.height,
    basePalette: generateAmstradCPCPalette(),
    preselected: lockedVecs,
    quantConfig: {
      colorSpace,
      distanceMetric
    }
  })
})

// 4. Palette réduite copiée profondément
export const reducedPaletteRawAtom = atom<Vector[]>((get) => {
  const quantizer = get(quantizerAtom)
  const mode = get(modeAtom)
  if (!quantizer) return []
  const raw = quantizer.quantize(CPC_MODE_CONFIG[mode].nColors)
  const res = raw.map((v) => [...v] as Vector)

  return res
})

// 5. Image preview finale avec copie défensive
export const previewImageAtom = atom((get) => {
  const mode = get(modeAtom)
  const quantizer = get(quantizerAtom)
  const reduced = get(reducedPaletteRawAtom)
  const reducedRgb = get(reducedPaletteRgbAtom) // ✅ palette déjà projetée en RGB
  const cropped = get(croppedImageAtom)
  const dithering = get(ditheringAtom)
  if (!quantizer || !cropped) return null

  // reduced est en espace de travail (Lab, XYZ, etc.)
  const previewBuffer = quantizer.dither(reduced, {
    mode: dithering.mode,
    intensity: dithering.intensity
  })

  // remappage final en RGB visible
  const remapped = remapImageDataToPalette(
    new ImageData(previewBuffer, cropped.width, cropped.height),
    reducedRgb
  )

  // Convert ImageData to Canvas for drawImage
  const remappedCanvas = document.createElement('canvas')
  remappedCanvas.width = remapped.width
  remappedCanvas.height = remapped.height
  remappedCanvas.getContext('2d')!.putImageData(remapped, 0, 0)

  const targetW = CPC_MODE_CONFIG[mode].width

  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = targetW
  finalCanvas.height = 200
  const finalCtx = finalCanvas.getContext('2d')!
  finalCtx.imageSmoothingEnabled = false

  const dx = Math.floor((targetW - remapped.width) / 2)
  const dy = Math.floor((200 - remapped.height) / 2)

  finalCtx.drawImage(
    remappedCanvas,
    0,
    0,
    remapped.width,
    remapped.height,
    dx,
    dy,
    remapped.width,
    remapped.height
  )
  return finalCtx.getImageData(0, 0, targetW, 200)
})

export const reducedPaletteRgbAtom = atom<Vector<'RGB'>[]>((get) => {
  const colorSpace = get(colorSpaceAtom)
  const toRGB = getColorSpaceToRgbFn(colorSpace)
  const raw = get(reducedPaletteRawAtom)
  const projected = raw.map(toRGB)

  return projected
})
