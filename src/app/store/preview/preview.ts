import { extractBuffer, createQuantizer } from '@/libs/pixsaur-color/src'
import { Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { getVisualRegion } from '@/utils/get-visual-region'
import { atom } from 'jotai'
import { modeAtom, colorSpaceAtom, ditheringAtom } from '../config/config'
import { CPC_MODE_CONFIG } from '../config/types'
import { srcAtom, selectionAtom } from '../image/image'
import { lockedVectorsAtom } from '../palette/palette'
import { remapImageDataToPalette } from '@/utils/exports/rgb-to-indexes'

// 1. Zone sélectionnée réduite à la largeur du mode
export const croppedImageAtom = atom((get) => {
  const src = get(srcAtom)
  const selection = get(selectionAtom)
  const mode = get(modeAtom)
  const targetWidth = CPC_MODE_CONFIG[mode].width
  if (!src || !selection) return null

  // 1) On récupère la région visuelle brute
  const fullImageData = getVisualRegion(
    src,
    selection,
    targetWidth,
    CPC_MODE_CONFIG[mode].mode
  )

  // on utilise putImageData + drawImage pour combiner scaling & data
  // d’abord on colle l’ImageData brute sur un petit canvas,
  // puis on le redessine à l’échelle sur tempCanvas

  return fullImageData
})

// 2. Extraction des données RGBA (sans effets visuels pour l'instant)
export const croppedBufferAtom = atom((get) => {
  const cropped = get(croppedImageAtom)
  if (!cropped) return null
  return extractBuffer(cropped)
})

// 3. Construction du quantizer (palette + configuration)
export const quantizerAtom = atom((get) => {
  const buf = get(croppedBufferAtom)
  const cropped = get(croppedImageAtom)
  const lockedVecs = get(lockedVectorsAtom) // ← vecteurs verrouillés
  const colorSpace = get(colorSpaceAtom)
  if (!buf || !cropped) return null

  return createQuantizer({
    buf,
    width: cropped.width,
    height: cropped.height,
    basePalette: generateAmstradCPCPalette(),
    preselected: lockedVecs, // ← on passe les vecteurs directement
    quantConfig: {
      colorSpace,
      distanceMetric: 'euclidean'
    }
  })
})

// 4. Palette réduite calculée
export const reducedPaletteAtom = atom<Vector[]>((get) => {
  const quantizer = get(quantizerAtom)
  const mode = get(modeAtom)
  if (!quantizer) return []
  return quantizer.quantize(CPC_MODE_CONFIG[mode].nColors)
})

// 5. Image preview ditherée finale
export const previewImageAtom = atom((get) => {
  const quantizer = get(quantizerAtom)
  const reduced = get(reducedPaletteAtom)
  const cropped = get(croppedImageAtom)
  const dithering = get(ditheringAtom)
  if (!quantizer || !cropped) return null

  const previewBuffer = quantizer.dither(reduced, {
    mode: dithering.mode,
    intensity: dithering.intensity
  })

  return remapImageDataToPalette(
    new ImageData(previewBuffer, cropped.width, cropped.height),
    reduced
  )
})
