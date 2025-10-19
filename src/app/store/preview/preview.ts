import { atom } from 'jotai'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { DISTANCE_METRICS_BY_COLORSPACE } from '@/libs/pixsaur-color/src/metric/distance'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
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

/**
 * Quantifie une valeur RGB (0-255) vers CPC Classic (0, 128, 255)
 */
function quantizeCPC(value: number): number {
  const cpcValues = [0, 128, 255]
  return cpcValues.reduce(
    (prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
    cpcValues[0]
  )
}

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
  const cpcHardware = get(cpcHardwareAtom)
  const contrastStrategy = get(contrastStrategyAtom)

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

  // 🎯 Quantifier les couleurs lockées selon le hardware AVANT de les passer au quantizer
  const quantifyToCPCPlus = (value: number): number => {
    const val4bit = Math.round((value / 255) * 15)
    return Math.round((val4bit / 15) * 255)
  }

  const quantifiedLockedVecs =
    cpcHardware === 'plus'
      ? lockedVecs.map(
          (color) =>
            [
              quantifyToCPCPlus(color[0]),
              quantifyToCPCPlus(color[1]),
              quantifyToCPCPlus(color[2])
            ] as Vector<'RGB'>
        )
      : lockedVecs.map(
          (color) =>
            [
              quantizeCPC(color[0]),
              quantizeCPC(color[1]),
              quantizeCPC(color[2])
            ] as Vector<'RGB'>
        )

  console.log('🔍 [QUANTIZER DEBUG] Input params:', {
    targetColors,
    basePaletteSize: basePalette.length,
    lockedColorsCount: quantifiedLockedVecs.length,
    lockedColors: quantifiedLockedVecs,
    cpcHardware
  })

  const palette = await paletteProcessor.quantizePalette(
    buf,
    cropped,
    targetColors,
    basePalette,
    quantifiedLockedVecs,
    contrastStrategy // 🎯 Utiliser la stratégie choisie par l'utilisateur
  )

  console.log('🔍 [QUANTIZER DEBUG] Output palette:', palette)

  return palette
})

// 5. Image preview finale avec cache dithering optimisé
export const previewImageAtom = atom(async (get) => {
  const mode = get(modeAtom)
  const quantizer = await get(quantizerAtom)
  const reduced = await get(reducedPaletteRgbAtom) // ✅ Utiliser la palette quantifiée
  // reducedRgb n'est plus nécessaire: le dithering retourne déjà du RGB
  const cropped = await get(croppedImageAtom)
  const dithering = get(ditheringAtom)
  if (!quantizer || !cropped) return null

  // 🔍 DEBUG: Vérifier la palette avant dithering
  console.log('🎨 [PREVIEW] Palette for dithering:', {
    count: reduced.length,
    colors: reduced.map((c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`),
    mode
  })

  logger.time('🖼️ Preview Generation')

  const normalized = getVisualRegionNormalized(cropped, mode)
  if (!normalized) return null

  logger.time('  📐 Dithering')

  const previewBuffer = quantizer.dither(normalized, reduced, {
    mode: dithering.mode,
    intensity: dithering.intensity
  })

  // 🔍 DEBUG: Analyser les couleurs réelles dans le buffer après dithering
  const colorCounts = new Map<string, number>()
  for (let i = 0; i < previewBuffer.length; i += 4) {
    const r = previewBuffer[i]
    const g = previewBuffer[i + 1]
    const b = previewBuffer[i + 2]
    const key = `${r},${g},${b}`
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1)
  }
  const top5 = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color, count]) => `rgb(${color}):${count}`)
  logger.info(`🔍 [PREVIEW] Top 5 colors after dithering: ${top5.join(' | ')}`)

  logger.time('  🎯 Remapping')
  // ✅ Le dithering retourne déjà un buffer RGB, pas besoin de remapping!
  // Le remapImageDataToPalette était utilisé avant quand on avait des indices
  const remapped = new ImageData(
    new Uint8ClampedArray(previewBuffer),
    normalized.width,
    normalized.height
  )
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

  // Colors are already in RGB format, no conversion needed
  const projected = [...raw] // Create a copy to avoid mutating original

  // FUTURE ENHANCEMENT: No longer force black color for padding
  // Padding pixels will be mapped to darkest color during export
  // This preserves color diversity in the quantized palette

  // Quantification selon le hardware sélectionné
  if (cpcHardware === 'classic') {
    quantifyCPCClassicWithLocked(projected, new Set()) // Quantifier tout
  } else if (cpcHardware === 'plus') {
    // Pour CPC Plus, quantifier selon le format 4-bit par composante
    quantifyCPCPlusWithLocked(projected, new Set()) // Quantifier tout
  }

  // S'assurer qu'on ne dépasse jamais la limite finale
  const maxColors = CPC_MODE_CONFIG[mode].nColors
  if (projected.length > maxColors) {
    // Tronquer à maxColors (les couleurs lockées sont déjà en tête grâce au quantizer)
    projected.splice(maxColors)
  }

  return projected
})
