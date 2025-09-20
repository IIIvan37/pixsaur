import { atom } from 'jotai'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { ColorSpaceDistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { getColorSpaceToRgbFn } from '@/libs/pixsaur-color/src/space'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { remapImageDataToPalette } from '@/utils/exports/rgb-to-indexes/rgb-to-indexes'
import {
  getVisualRegion,
  getVisualRegionNormalized
} from '@/utils/get-visual-region'
import { logger } from '@/utils/logger'
import { paletteProcessorAtom } from '../adapters/processors'
import {
  colorSpaceAtom,
  contrastStrategyAtom,
  ditheringAtom,
  modeAtom
} from '../config/config'
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
  const contrastStrategy = get(contrastStrategyAtom)
  if (!buf || !cropped) return null

  const availableMetrics = ColorSpaceDistanceMetric[colorSpace]
  const distanceMetric = availableMetrics[0]

  const quantizer = createQuantizer({
    buf,

    basePalette: generateAmstradCPCPalette(),
    preselected: lockedVecs,
    quantConfig: {
      colorSpace,
      distanceMetric,
      contrastStrategy
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
  // Dépendance pour recalculer quand la stratégie change
  get(contrastStrategyAtom)

  if (!buf || !cropped) return []

  // 🚀 UTILISATION DES PROCESSEURS CENTRALISÉS (réutilisation de cache)
  const paletteProcessor = get(paletteProcessorAtom)
  if (!paletteProcessor) {
    logger.warn('Palette processor not initialized')
    return []
  }

  const palette = await paletteProcessor.quantizePalette(
    buf,
    cropped,
    CPC_MODE_CONFIG[mode].nColors,
    generateAmstradCPCPalette(),
    lockedVecs,
    colorSpace
  )

  return palette
})

// 5. Image preview finale avec cache dithering optimisé
export const previewImageAtom = atom(async (get) => {
  const mode = get(modeAtom)
  const quantizer = await get(quantizerAtom)
  const reduced = await get(reducedPaletteRawAtom)
  const reducedRgb = await get(reducedPaletteRgbAtom) // ✅ palette déjà projetée en RGB
  const cropped = await get(croppedImageAtom)
  const dithering = get(ditheringAtom)
  if (!quantizer || !cropped) return null

  logger.time('🖼️ Preview Generation')

  const normalized = getVisualRegionNormalized(cropped, mode)
  if (!normalized) return null

  logger.time('  📐 Dithering')

  const previewBuffer = quantizer.dither(normalized, reduced, {
    mode: dithering.mode,
    intensity: dithering.intensity
  })

  logger.time('  🎯 Remapping')
  // remappage final en RGB visible - VERSION OPTIMISÉE (MUTATION EN PLACE)
  const imageDataToRemap = new ImageData(
    new Uint8ClampedArray(previewBuffer), // Buffer du cache ou nouveau
    normalized.width,
    normalized.height
  )
  const remapped = remapImageDataToPalette(imageDataToRemap, reducedRgb)
  logger.timeEnd('  🎯 Remapping')

  logger.time('  🖌️ Canvas Operations')

  const targetW = CPC_MODE_CONFIG[mode].width
  const targetH = CPC_MODE_CONFIG[mode].height

  // ✅ OPTIMISATION: Réutiliser un seul canvas pour tout le pipeline
  const workCanvas = document.createElement('canvas')
  workCanvas.width = Math.max(remapped.width, targetW)
  workCanvas.height = Math.max(remapped.height, targetH)
  const workCtx = workCanvas.getContext('2d')
  if (!workCtx) return null

  // Clear et setup du canvas
  workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height)
  workCtx.putImageData(remapped, 0, 0)
  // ✅ OPTIMISATION: Centrage direct sans drawImage supplémentaire
  const dx = Math.floor((targetW - remapped.width) / 2)
  const dy = Math.floor((targetH - remapped.height) / 2)

  // Si pas de centrage nécessaire, utiliser directement l'image remappée
  let result: ImageData
  if (
    dx === 0 &&
    dy === 0 &&
    remapped.width === targetW &&
    remapped.height === targetH
  ) {
    result = remapped // Pas de recopie nécessaire
  } else {
    // Créer canvas final seulement si centrage nécessaire
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = targetW
    finalCanvas.height = targetH
    const finalCtx = finalCanvas.getContext('2d')!
    finalCtx.imageSmoothingEnabled = true
    finalCtx.imageSmoothingQuality = 'high'
    finalCtx.putImageData(remapped, dx, dy)
    result = finalCtx.getImageData(0, 0, targetW, targetH)
  }
  logger.timeEnd('  🖌️ Canvas Operations')
  logger.timeEnd('🖼️ Preview Generation')
  return result
})

export const reducedPaletteRgbAtom = atom(async (get) => {
  const colorSpace = get(colorSpaceAtom)
  const toRGB = getColorSpaceToRgbFn(colorSpace)
  const raw = await get(reducedPaletteRawAtom)

  // Conversion colorspace vers RGB
  const projected = raw.map(toRGB)

  // Helper pour quantification CPC optimisée
  const quantifyToCP = (value: number): number => {
    if (value <= 64) return 0
    if (value <= 192) return 128
    return 255
  }

  // Quantify colors to match CPC palette values (0, 128, 255) - OPTIMISÉ
  for (const color of projected) {
    const r = color[0]
    const g = color[1]
    const b = color[2]

    // Quantification optimisée en place
    color[0] = quantifyToCP(r)
    color[1] = quantifyToCP(g)
    color[2] = quantifyToCP(b)
  }

  return projected
})
