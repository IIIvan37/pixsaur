import { extractBuffer, createQuantizer } from '@/libs/pixsaur-color/src'
import { Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { getVisualRegion } from '@/utils/get-visual-region'
import { atom } from 'jotai'
import { modeAtom, colorSpaceAtom, ditheringAtom } from '../config/config'
import { CPC_MODE_CONFIG } from '../config/types'
import { srcAtom, selectionAtom } from '../image/image'
import { lockedVectorsAtom } from '../palette/palette'

function cropTopLines(image: ImageData, maxLines = 200): ImageData {
  const { width, height, data } = image
  const finalHeight = Math.min(height, maxLines)

  // Canvas de sortie, toujours 200 lignes
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = maxLines
  const ctx = canvas.getContext('2d')!

  const output = ctx.createImageData(width, maxLines)
  const out = output.data

  for (let y = 0; y < finalHeight; y++) {
    const srcOffset = y * width * 4
    const dstOffset = y * width * 4
    for (let x = 0; x < width * 4; x++) {
      out[dstOffset + x] = data[srcOffset + x]
    }
  }

  // Les lignes restantes (si < 200) restent noires (0)
  ctx.putImageData(output, 0, 0)
  return ctx.getImageData(0, 0, width, maxLines)
}

// 1. Zone sélectionnée réduite à la largeur du mode
export const croppedImageAtom = atom((get) => {
  const src = get(srcAtom)
  const selection = get(selectionAtom)
  const mode = get(modeAtom)
  const targetWidth = CPC_MODE_CONFIG[mode].width
  if (!src || !selection) return null

  // 1) On récupère la région visuelle brute
  const fullImageData = getVisualRegion(src, selection, targetWidth)

  // on utilise putImageData + drawImage pour combiner scaling & data
  // d’abord on colle l’ImageData brute sur un petit canvas,
  // puis on le redessine à l’échelle sur tempCanvas

  return cropTopLines(fullImageData, 200)
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

  return new ImageData(previewBuffer, cropped.width, cropped.height)
})
