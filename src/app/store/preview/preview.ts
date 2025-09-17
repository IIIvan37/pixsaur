import { atom } from 'jotai'
import { processorFactory } from '@/libs/pixsaur-adapter'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { ColorSpaceDistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { getColorSpaceToRgbFn } from '@/libs/pixsaur-color/src/space'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { remapImageDataToPalette } from '@/utils/exports/rgb-to-indexes'
import {
  getVisualRegion,
  getVisualRegionNormalized
} from '@/utils/get-visual-region'
import { colorSpaceAtom, ditheringAtom, modeAtom } from '../config/config'
import { CPC_MODE_CONFIG } from '../config/types'
import { selectionAtom, workingImageAtom } from '../image/image'
import { lockedVectorsAtom } from '../palette/palette'

export const previewCanvasWidthAtom = atom<number | null>(null)

export const previewCanvasSizeAtom = atom((get) => {
  const width = get(previewCanvasWidthAtom)
  if (!width) return { width: 0, height: 0 }
  const height = Math.floor(width * (200 / 320))
  return { width, height }
})

// 1. Zone sélectionnée réduite à la largeur du mode
export const croppedImageAtom = atom(async (get) => {
  const workingImageData = await get(workingImageAtom)
  const selection = get(selectionAtom)

  if (!workingImageData || !selection) return null

  return getVisualRegion(workingImageData, selection)
})

// 2. Extraction des données RGBA
export const croppedBufferAtom = atom(async (get) => {
  const cropped = await get(croppedImageAtom)
  if (!cropped) return null
  return extractBuffer(cropped)
})

// 3. Construction du quantizer sans mémoïsation
export const quantizerAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const cropped = await get(croppedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = get(colorSpaceAtom)
  if (!buf || !cropped) return null

  const availableMetrics = ColorSpaceDistanceMetric[colorSpace]
  const distanceMetric = availableMetrics[0]

  const quantizer = createQuantizer({
    buf,

    basePalette: generateAmstradCPCPalette(),
    preselected: lockedVecs,
    quantConfig: {
      colorSpace,
      distanceMetric
    }
  })
  return quantizer
})

// 4. Palette réduite via ADAPTATEUR (nouveau système principal)
export const reducedPaletteRawAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const cropped = await get(croppedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = get(colorSpaceAtom)
  const mode = get(modeAtom)

  if (!buf || !cropped) return []

  // 🚀 UTILISATION DE L'ADAPTATEUR comme système principal
  const processor = await processorFactory.createBestProcessor()

  const palette = await processor.quantizePalette(
    buf,
    cropped,
    CPC_MODE_CONFIG[mode].nColors,
    generateAmstradCPCPalette(),
    lockedVecs,
    colorSpace
  )

  return palette
})

// 5. Image preview finale avec copie défensive
export const previewImageAtom = atom(async (get) => {
  const mode = get(modeAtom)
  const quantizer = await get(quantizerAtom)
  const reduced = await get(reducedPaletteRawAtom)
  const reducedRgb = await get(reducedPaletteRgbAtom) // ✅ palette déjà projetée en RGB
  const cropped = await get(croppedImageAtom)
  const dithering = get(ditheringAtom)
  if (!quantizer || !cropped) return null

  console.time('🖼️ Preview Generation')

  const normalized = getVisualRegionNormalized(cropped, mode)

  console.time('  📐 Dithering')
  // reduced est en espace de travail (Lab, XYZ, etc.)
  const previewBuffer = quantizer.dither(normalized, reduced, {
    mode: dithering.mode,
    intensity: dithering.intensity
  })
  console.timeEnd('  📐 Dithering')

  console.time('  🎯 Remapping')
  // remappage final en RGB visible
  const remapped = remapImageDataToPalette(
    new ImageData(
      new Uint8ClampedArray(previewBuffer), // Ensure buffer is correct type
      normalized.width,
      normalized.height
    ),
    reducedRgb
  )
  console.timeEnd('  🎯 Remapping')

  console.time('  🖌️ Canvas Operations')
  // Convert ImageData to Canvas for drawImage
  const remappedCanvas = document.createElement('canvas')
  remappedCanvas.width = remapped.width
  remappedCanvas.height = remapped.height
  const remappedCtx = remappedCanvas.getContext('2d')
  if (!remappedCtx) return null
  remappedCtx.putImageData(remapped, 0, 0)

  const targetW = CPC_MODE_CONFIG[mode].width
  const targetH = CPC_MODE_CONFIG[mode].height

  // Création du canvas final avec la taille cible
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = targetW
  finalCanvas.height = targetH
  const finalCtx = finalCanvas.getContext('2d')
  if (!finalCtx) return null
  finalCtx.imageSmoothingEnabled = true
  finalCtx.imageSmoothingQuality = 'high'
  const dx = Math.floor((targetW - remapped.width) / 2)
  const dy = Math.floor((targetH - remapped.height) / 2)

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
  console.timeEnd('  🖌️ Canvas Operations')

  const result = finalCtx.getImageData(0, 0, targetW, targetH)
  console.timeEnd('🖼️ Preview Generation')
  return result
})

export const reducedPaletteRgbAtom = atom(async (get) => {
  const colorSpace = get(colorSpaceAtom)
  const toRGB = getColorSpaceToRgbFn(colorSpace)
  const raw = await get(reducedPaletteRawAtom)
  const projected = raw.map(toRGB)

  // Quantify colors to match CPC palette values (0, 128, 255)
  const quantified = projected.map(([r, g, b]) => {
    const quantizeCPC = (value: number): number => {
      const levels = [0, 128, 255]
      let best = levels[0]
      let bestDist = Math.abs(value - best)

      for (const lvl of levels) {
        const dist = Math.abs(value - lvl)
        if (dist < bestDist) {
          bestDist = dist
          best = lvl
        }
      }

      return best
    }

    return [quantizeCPC(r), quantizeCPC(g), quantizeCPC(b)] as Vector<'RGB'>
  })

  return quantified
})

// ====== ADAPTER-BASED ATOMS (alternative implementation) ======

/**
 * Atom alternatif utilisant l'adaptateur pour la quantization
 * Peut remplacer progressivement le système direct
 */
export const adapterPaletteAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const cropped = await get(croppedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = get(colorSpaceAtom)
  const mode = get(modeAtom)

  if (!buf || !cropped) return []

  const processor = await processorFactory.createBestProcessor()

  const palette = await processor.quantizePalette(
    buf,
    cropped,
    CPC_MODE_CONFIG[mode].nColors,
    generateAmstradCPCPalette(),
    lockedVecs,
    colorSpace
  )

  return palette
})
