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
  const targetWidth = CPC_MODE_CONFIG[mode].width
  if (!workingImageData || !selection) return null

  return getVisualRegion(
    workingImageData,
    selection,
    targetWidth,
    CPC_MODE_CONFIG[mode].mode
  )
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
  const distanceMetric = availableMetrics.includes('euclidean')
    ? 'euclidean'
    : availableMetrics[0]

  if (!availableMetrics.includes('euclidean')) {
    console.warn(
      `Distance metric "euclidean" is not valid for color space "${colorSpace}", using "${distanceMetric}" instead.`
    )
  }

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
export const reducedPaletteAtom = atom<Vector[]>((get) => {
  console.log('Recalcul de la palette réduite')
  const quantizer = get(quantizerAtom)
  const mode = get(modeAtom)
  if (!quantizer) return []
  const raw = quantizer.quantize(CPC_MODE_CONFIG[mode].nColors)
  console.log('palette avant', raw.map((c) => [...c]))
  return raw.map((v) => [...v] as Vector)
})

// 5. Image preview finale avec copie défensive
export const previewImageAtom = atom((get) => {
  const quantizer = get(quantizerAtom)
  const reduced = get(reducedPaletteAtom)
  const cropped = get(croppedImageAtom)
  const dithering = get(ditheringAtom)
  if (!quantizer || !cropped) return null

  const safePalette = reduced.map((v) => [...v] as Vector)
  const previewBuffer = quantizer.dither(safePalette, {
    mode: dithering.mode,
    intensity: dithering.intensity
  })
  console.log('palette après safe ?', safePalette)

  return remapImageDataToPalette(
    new ImageData(previewBuffer, cropped.width, cropped.height),
    safePalette
  )
})
