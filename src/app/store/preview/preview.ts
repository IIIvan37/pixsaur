import { atom } from 'jotai'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { DISTANCE_METRICS_BY_COLORSPACE } from '@/libs/pixsaur-color/src/metric/distance'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import { remapImageDataToPalette } from '@/utils/exports/rgb-to-indexes/rgb-to-indexes'
import {
  getVisualRegion,
  getVisualRegionNormalized
} from '@/utils/get-visual-region'
import { logger } from '@/utils/logger'
import { paletteProcessorAtom } from '../adapters/processors'
import {
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
  const colorSpace = 'RGB' // Fixé sur RGB
  const contrastStrategy = get(contrastStrategyAtom)
  const cpcHardware = get(cpcHardwareAtom)
  if (!buf || !cropped) return null

  const availableMetrics = DISTANCE_METRICS_BY_COLORSPACE[colorSpace]
  const distanceMetric = availableMetrics[0]

  const quantizer = createQuantizer({
    buf,
    basePalette: getPaletteForHardware(cpcHardware),
    preselected: lockedVecs,
    quantConfig: {
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
  // const colorSpace = 'RGB' // Fixé sur RGB (variable supprimée car non utilisée)
  const cpcHardware = get(cpcHardwareAtom)

  if (!buf || !cropped) return []

  const paletteProcessor = get(paletteProcessorAtom)
  if (!paletteProcessor) {
    logger.warn('Palette processor not initialized')
    return []
  }

  // 🔍 DEBUG: Log des paramètres de quantification
  const basePalette = getPaletteForHardware(cpcHardware)

  // 🎯 Utilisation du nombre de couleurs correct depuis l'optimisation CPC Plus
  const targetColors = CPC_MODE_CONFIG[mode].nColors

  console.log('🔍 [QUANTIZER DEBUG] Input params:', {
    targetColors,
    basePaletteSize: basePalette.length,
    lockedColorsCount: lockedVecs.length,
    lockedColors: lockedVecs,
    cpcHardware
  })

  const palette = await paletteProcessor.quantizePalette(
    buf,
    cropped,
    targetColors,
    basePalette,
    lockedVecs,
    // 🎯 SOLUTION: Force strategy 'max' pour CPC Plus pour plus de diversité
    cpcHardware === 'plus' ? 'max' : undefined
  )

  console.log('🔍 [QUANTIZER DEBUG] Output palette:', palette)

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

// Helper functions pour réduire la complexité cognitive
function quantifyCPCClassicWithLocked(
  projected: any[],
  lockedColorKeys: Set<string>
): void {
  const quantifyToCPClassic = (value: number): number => {
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

  for (const color of projected) {
    const colorKey = `${color[0]},${color[1]},${color[2]}`

    // Skip quantification for locked colors
    if (lockedColorKeys.has(colorKey)) {
      continue
    }

    const r = color[0]
    const g = color[1]
    const b = color[2]

    color[0] = quantifyToCPClassic(r)
    color[1] = quantifyToCPClassic(g)
    color[2] = quantifyToCPClassic(b)
  }
}

function quantifyCPCPlusWithLocked(
  projected: any[],
  lockedColorKeys: Set<string>
): void {
  // Quantifier selon le format CPC Plus (4-bit par composante)
  const quantifyToCPCPlus = (value: number): number => {
    // Convertir 8-bit vers 4-bit puis retour vers 8-bit
    const val4bit = Math.round((value / 255) * 15)
    return Math.round((val4bit / 15) * 255)
  }

  for (const color of projected) {
    const colorKey = `${color[0]},${color[1]},${color[2]}`

    // Skip quantification for locked colors
    if (lockedColorKeys.has(colorKey)) {
      continue
    }

    const r = color[0]
    const g = color[1]
    const b = color[2]

    color[0] = quantifyToCPCPlus(r)
    color[1] = quantifyToCPCPlus(g)
    color[2] = quantifyToCPCPlus(b)
  }
}

export const reducedPaletteRgbAtom = atom(async (get) => {
  const cpcHardware = get(cpcHardwareAtom)
  const raw = await get(reducedPaletteRawAtom)
  const mode = get(modeAtom)
  const lockedVecs = get(lockedVectorsAtom)

  // Colors are already in RGB format, no conversion needed
  const projected = [...raw] // Create a copy to avoid mutating original

  // FUTURE ENHANCEMENT: No longer force black color for padding
  // Padding pixels will be mapped to darkest color during export
  // This preserves color diversity in the quantized palette

  // Créer un Set des couleurs verrouillées pour les préserver
  const lockedColorKeys = new Set(
    lockedVecs.map((color) => `${color[0]},${color[1]},${color[2]}`)
  )

  // S'assurer que toutes les couleurs verrouillées sont présentes dans la palette
  for (const lockedColor of lockedVecs) {
    const colorKey = `${lockedColor[0]},${lockedColor[1]},${lockedColor[2]}`
    const existsInProjected = projected.some(
      (color) => `${color[0]},${color[1]},${color[2]}` === colorKey
    )

    if (!existsInProjected) {
      projected.push([lockedColor[0], lockedColor[1], lockedColor[2]])
    }
  }

  // S'assurer qu'on ne dépasse jamais la limite finale
  const maxColors = CPC_MODE_CONFIG[mode].nColors
  if (projected.length > maxColors) {
    // Garder les couleurs verrouillées et supprimer les excédentaires non-verrouillées
    const lockedColors = projected.filter((color) =>
      lockedColorKeys.has(`${color[0]},${color[1]},${color[2]}`)
    )
    const unlockedColors = projected.filter(
      (color) => !lockedColorKeys.has(`${color[0]},${color[1]},${color[2]}`)
    )

    const availableSlots = maxColors - lockedColors.length
    const finalUnlocked = unlockedColors.slice(0, Math.max(0, availableSlots))

    projected.splice(0, projected.length, ...lockedColors, ...finalUnlocked)
  }

  // Quantification selon le hardware sélectionné
  if (cpcHardware === 'classic') {
    quantifyCPCClassicWithLocked(projected, lockedColorKeys)
  } else if (cpcHardware === 'plus') {
    // Pour CPC Plus, quantifier selon le format 4-bit par composante
    quantifyCPCPlusWithLocked(projected, lockedColorKeys)
  }

  return projected
})
