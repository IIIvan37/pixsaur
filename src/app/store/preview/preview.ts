import { atom } from 'jotai'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { DISTANCE_METRICS_BY_COLORSPACE } from '@/libs/pixsaur-color/src/metric/distance'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import {
  getVisualRegion,
  getVisualRegionNormalized
} from '@/utils/get-visual-region'
import { applyResize, type Selection } from '@/utils/image-resize'
import { logger } from '@/utils/logger'
import { paletteProcessorAtom } from '../adapters/processors'
import {
  centerImageAtom,
  contrastStrategyAtom,
  cpcHardwareAtom,
  derivedModeAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  resizeModeAtom
} from '../config/config'
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
  const containerWidth = get(previewCanvasWidthAtom)
  const mode = get(derivedModeAtom)
  const resizeMode = get(resizeModeAtom)

  if (!containerWidth) return { width: 0, height: 0 }

  // Obtenir la configuration du mode CPC pour le pixel aspect ratio
  const modeConfig = get(effectiveModeConfigAtom)

  // En mode origin, utiliser les dimensions normalisées (160/320/640)
  // En mode auto, utiliser les dimensions du mode config
  const canvasWidth = modeConfig.width
  const canvasHeight = modeConfig.height

  // Dimensions visuelles = dimensions canvas × pixel aspect ratio
  const visualWidth = canvasWidth * modeConfig.scaleX
  const visualHeight = canvasHeight * modeConfig.scaleY

  // Calculer le scale pour fit dans le container (sans dépasser la largeur disponible)
  const scale = Math.min(containerWidth / visualWidth, 1) // Ne pas upscaler

  const width = Math.floor(visualWidth * scale)
  const height = Math.floor(visualHeight * scale)

  console.log('📐 [PREVIEW CANVAS SIZE]', {
    mode,
    resizeMode,
    canvasWidth,
    canvasHeight,
    scaleX: modeConfig.scaleX,
    scaleY: modeConfig.scaleY,
    visualWidth,
    visualHeight,
    containerWidth,
    scale,
    displayWidth: width,
    displayHeight: height
  })

  return { width, height }
})

// 1. Zone sélectionnée extraite de l'image source
export const croppedImageAtom = atom(async (get) => {
  const workingImageData = await get(workingImageAtom)
  const selection = get(selectionAtom)

  if (!workingImageData || !selection) return null

  return getVisualRegion(workingImageData, selection)
})

// 1bis. Resize : applique la transformation selon le mode sélectionné
// Mode 'auto' = comportement par défaut (smart resize avec aspect ratio CPC)
export const resizedImageAtom = atom(async (get) => {
  const cropped = await get(croppedImageAtom)
  const resizeMode = get(resizeModeAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const centerImage = get(centerImageAtom)

  if (!cropped) {
    return cropped
  }

  // Convertir ImageData en Canvas pour applyResize
  const canvas = document.createElement('canvas')
  canvas.width = cropped.width
  canvas.height = cropped.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return cropped

  ctx.putImageData(cropped, 0, 0)

  // Préparer la sélection relative (source = tout le canvas cropped)
  const relativeSelection: Selection = {
    sx: 0,
    sy: 0,
    width: cropped.width,
    height: cropped.height
  }

  // Appliquer le resize selon le mode (dimensions calculées automatiquement)
  try {
    const resizedCanvas = applyResize(
      canvas,
      relativeSelection,
      {
        mode: resizeMode,
        modeConfig
      },
      centerImage
    )

    // Convertir Canvas → ImageData
    const resizedCtx = resizedCanvas.getContext('2d')
    if (!resizedCtx) return cropped

    return resizedCtx.getImageData(
      0,
      0,
      resizedCanvas.width,
      resizedCanvas.height
    )
  } catch (error) {
    logger.error('Resize failed:', error)
    return cropped // Fallback sur l'image croppée
  }
})

// 2. Extraction des données RGBA (utilise resizedImageAtom au lieu de croppedImageAtom)
export const croppedBufferAtom = atom(async (get) => {
  const processed = await get(resizedImageAtom)
  if (!processed) return null
  return extractBuffer(processed)
})

// 3. Construction du quantizer sans mémoïsation
export const quantizerAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const processed = await get(resizedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = 'RGB' // Fixé sur RGB
  const contrastStrategy = get(contrastStrategyAtom)
  const cpcHardware = get(cpcHardwareAtom)
  if (!buf || !processed) return null

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
  const processed = await get(resizedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const cpcHardware = get(cpcHardwareAtom)
  const contrastStrategy = get(contrastStrategyAtom)

  if (!buf || !processed) return []

  const paletteProcessor = get(paletteProcessorAtom)
  if (!paletteProcessor) {
    logger.warn('Palette processor not initialized')
    return []
  }

  // 🔍 DEBUG: Log des paramètres de quantification
  const basePalette = getPaletteForHardware(cpcHardware)

  // 🎯 Utilisation du nombre de couleurs correct depuis l'optimisation CPC Plus
  const modeConfig = get(effectiveModeConfigAtom)
  const targetColors = modeConfig.nColors

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
    processed,
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
  const mode = get(derivedModeAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const quantizer = await get(quantizerAtom)
  const reduced = await get(reducedPaletteRgbAtom) // ✅ Utiliser la palette quantifiée
  // reducedRgb n'est plus nécessaire: le dithering retourne déjà du RGB
  const processed = await get(resizedImageAtom)
  const dithering = get(ditheringAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom) // Get center option
  if (!quantizer || !processed) return null

  // 🔍 DEBUG: Vérifier la palette avant dithering
  console.log('🎨 [PREVIEW] Palette for dithering:', {
    count: reduced.length,
    colors: reduced.map((c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`),
    mode
  })

  logger.time('🖼️ Preview Generation')

  console.log('🔍 [BEFORE NORMALIZATION]', {
    resizeMode,
    processedWidth: processed.width,
    processedHeight: processed.height,
    willSkipNormalization: resizeMode === 'origin'
  })

  // 🎯 En mode origin, l'image est déjà aux bonnes dimensions CPC (160x200, 320x200, 640x200)
  // On ne doit PAS appliquer getVisualRegionNormalized qui re-scale avec le pixel aspect ratio
  const normalized =
    resizeMode === 'origin'
      ? processed // Utiliser directement l'image sans normalisation
      : getVisualRegionNormalized(processed, modeConfig)

  if (!normalized) return null

  console.log('🔍 [AFTER NORMALIZATION]', {
    normalizedWidth: normalized.width,
    normalizedHeight: normalized.height
  })

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

  // 🎯 Positionnement pour le mode auto (origin gère son propre centrage)
  // En mode auto, getVisualRegionNormalized retourne une ImageData de taille variable (scaledW × scaledH)
  // qu'il faut placer dans un canvas à la taille cible (160x200 ou 320x200)
  if (resizeMode === 'auto') {
    logger.time('  📐 Positioning (auto mode)')
    const modeConfig = get(effectiveModeConfigAtom)
    const targetWidth = modeConfig.width
    const targetHeight = modeConfig.height

    // Si l'image est déjà à la taille cible, pas besoin de la repositionner
    if (remapped.width === targetWidth && remapped.height === targetHeight) {
      logger.timeEnd('  📐 Positioning (auto mode)')
      logger.timeEnd('🖼️ Preview Generation')
      return remapped
    }

    // Créer un canvas à la taille cible
    const positionedCanvas = document.createElement('canvas')
    positionedCanvas.width = targetWidth
    positionedCanvas.height = targetHeight
    const ctx = positionedCanvas.getContext('2d')
    if (!ctx) {
      logger.warn('Failed to get canvas context for positioning')
      logger.timeEnd('  📐 Positioning (auto mode)')
      logger.timeEnd('🖼️ Preview Generation')
      return remapped
    }

    // Remplir avec la couleur la plus sombre de la palette (pour le padding)
    const darkestColor = reduced.reduce((darkest, color) => {
      const brightness = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114
      const darkestBrightness =
        darkest[0] * 0.299 + darkest[1] * 0.587 + darkest[2] * 0.114
      return brightness < darkestBrightness ? color : darkest
    }, reduced[0])

    ctx.fillStyle = `rgb(${darkestColor[0]}, ${darkestColor[1]}, ${darkestColor[2]})`
    ctx.fillRect(0, 0, targetWidth, targetHeight)

    // Calculer la position selon l'option de centrage
    // centerImage = true : centré (dx/dy calculés)
    // centerImage = false : aligné en haut à gauche (dx=0, dy=0)
    const dx = centerImage ? Math.floor((targetWidth - remapped.width) / 2) : 0
    const dy = centerImage
      ? Math.floor((targetHeight - remapped.height) / 2)
      : 0

    // Créer un canvas temporaire pour l'image remappée
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = remapped.width
    tempCanvas.height = remapped.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) {
      logger.warn('Failed to get temp canvas context')
      logger.timeEnd('  📐 Positioning (auto mode)')
      logger.timeEnd('🖼️ Preview Generation')
      return remapped
    }
    tempCtx.putImageData(remapped, 0, 0)

    // Dessiner l'image à la position calculée (centrée ou top-left selon centerImage)
    ctx.drawImage(tempCanvas, dx, dy)

    // Récupérer l'ImageData finale
    const positioned = ctx.getImageData(0, 0, targetWidth, targetHeight)
    logger.timeEnd('  📐 Positioning (auto mode)')
    logger.timeEnd('🖼️ Preview Generation')
    return positioned
  }

  logger.timeEnd('🖼️ Preview Generation')
  return remapped
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
  const modeConfig = get(effectiveModeConfigAtom)

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
  const maxColors = modeConfig.nColors
  if (projected.length > maxColors) {
    // Tronquer à maxColors (les couleurs lockées sont déjà en tête grâce au quantizer)
    projected.splice(maxColors)
  }

  return projected
})
