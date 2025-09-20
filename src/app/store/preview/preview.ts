import { atom } from 'jotai'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { ColorSpaceDistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { getColorSpaceToRgbFn } from '@/libs/pixsaur-color/src/space'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
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
  cpcHardwareAtom,
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
  const cpcHardware = get(cpcHardwareAtom)
  if (!buf || !cropped) return null

  const availableMetrics = ColorSpaceDistanceMetric[colorSpace]
  const distanceMetric = availableMetrics[0]

  const quantizer = createQuantizer({
    buf,
    basePalette: getPaletteForHardware(cpcHardware),
    preselected: lockedVecs,
    quantConfig: {
      colorSpace,
      distanceMetric,
      contrastStrategy
    }
  })
  return quantizer
})

// 4. Quantization avec palette adaptateur
export const reducedPaletteRawAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const cropped = await get(croppedImageAtom)
  const mode = get(modeAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = get(colorSpaceAtom)
  const cpcHardware = get(cpcHardwareAtom)

  if (!buf || !cropped) return []

  const paletteProcessor = get(paletteProcessorAtom)
  if (!paletteProcessor) {
    logger.warn('Palette processor not initialized')
    return []
  }

  // 🔍 DEBUG: Log des paramètres de quantification
  const basePalette = getPaletteForHardware(cpcHardware)
  
  // 🎯 SOLUTION: Augmenter drastiquement pour CPC Plus pour forcer la diversité
  const targetColors = cpcHardware === 'plus' 
    ? Math.min(512, CPC_MODE_CONFIG[mode].nColors * 32) // 32x plus de couleurs pour maximiser la diversité
    : CPC_MODE_CONFIG[mode].nColors

  console.log(`🔍 [DEBUG] CPC Hardware: ${cpcHardware}`)
  console.log(`🔍 [DEBUG] Base palette size: ${basePalette.length} colors`)
  console.log(`🔍 [DEBUG] Target colors: ${targetColors} (original: ${CPC_MODE_CONFIG[mode].nColors})`)
  console.log(`🔍 [DEBUG] Color space: ${colorSpace}`)

  const palette = await paletteProcessor.quantizePalette(
    buf,
    cropped,
    targetColors,
    basePalette,
    lockedVecs,
    colorSpace,
    // 🎯 SOLUTION: Force strategy 'max' pour CPC Plus pour plus de diversité
    cpcHardware === 'plus' ? 'max' : undefined
  )

  // 🔍 DEBUG: Log du résultat de quantification
  console.log(`🔍 [DEBUG] Quantized palette result: ${palette.length} colors`)
  console.log(`🔍 [DEBUG] First 5 colors:`, palette.slice(0, 5))

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
  const cpcHardware = get(cpcHardwareAtom)
  const toRGB = getColorSpaceToRgbFn(colorSpace)
  const raw = await get(reducedPaletteRawAtom)

  // 🔍 DEBUG: Log de la conversion vers RGB
  console.log(`🔍 [DEBUG RGB] Converting ${raw.length} colors from ${colorSpace} to RGB`)
  console.log(`🔍 [DEBUG RGB] Hardware: ${cpcHardware}`)

  // Conversion colorspace vers RGB
  const projected = raw.map(toRGB)

  // 🔍 DEBUG: Log des couleurs avant quantification hardware
  console.log(`🔍 [DEBUG RGB] Before hardware quantification:`, projected.slice(0, 5))

  // Quantification selon le hardware sélectionné
  if (cpcHardware === 'classic') {
    // Helper pour quantification CPC classique optimisée
    const quantifyToCPClassic = (value: number): number => {
      if (value <= 64) return 0
      if (value <= 192) return 128
      return 255
    }

    // Quantify colors to match CPC classic palette values (0, 128, 255)
    for (const color of projected) {
      const r = color[0]
      const g = color[1]
      const b = color[2]

      // Quantification optimisée en place
      color[0] = quantifyToCPClassic(r)
      color[1] = quantifyToCPClassic(g)
      color[2] = quantifyToCPClassic(b)
    }
    console.log(`🔍 [DEBUG RGB] After CPC Classic quantification:`, projected.slice(0, 5))
  } else {
    // CPC Plus: PAS de quantification supplémentaire !
    // Les couleurs sont déjà correctement générées par generateCPCPlusPalette()
    // qui scale correctement les valeurs 4-bit (0-15) vers 8-bit (0-255)
    // Toute requantification ici casserait la précision CPC Plus
    console.log(`🔍 [DEBUG RGB] CPC Plus: NO additional quantification applied`)
    console.log(`🔍 [DEBUG RGB] Final CPC Plus colors:`, projected.slice(0, 5))
  }

  return projected
})
