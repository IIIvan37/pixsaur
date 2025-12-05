import { atom } from 'jotai'
import { logger } from '@/core'
import { quantifyToCPCPlus, quantizeCPC } from '@/export'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { DISTANCE_METRICS_BY_COLORSPACE } from '@/libs/pixsaur-color/src/metric/distance'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { luminance } from '@/libs/pixsaur-color/src/utils/luminance'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import {
  applyHorizontalSmoothing,
  getPixelWidthForMode,
  getVisualRegion,
  getVisualRegionNormalized
} from '@/preview'
import { applyResize, type Selection } from '@/source'
import { paletteProcessorAtom } from '../adapters/processors'
import {
  centerImageAtom,
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  horizontalSmoothingAtom,
  paletteStrategyAtom,
  pixelModeAtom,
  resizeModeAtom
} from '../config/config'
import { selectionAtom, workingImageAtom } from '../image/image'
import {
  lockedEmptySlotsCountAtom,
  lockedVectorsAtom,
  userPaletteAtom
} from '../palette/palette'

export const previewCanvasWidthAtom = atom<number | null>(null)

export const previewCanvasSizeAtom = atom((get) => {
  const containerWidth = get(previewCanvasWidthAtom)

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

// 1ter. Lissage horizontal : applique le lissage APRÈS le resize
export const smoothedImageAtom = atom(async (get) => {
  const resized = await get(resizedImageAtom)
  const horizontalSmoothing = get(horizontalSmoothingAtom)
  const pixelMode = get(pixelModeAtom)

  if (!resized) return null

  // Appliquer le lissage horizontal si activé
  if (horizontalSmoothing) {
    const pixelWidth = getPixelWidthForMode(pixelMode)
    if (pixelWidth > 1) {
      return applyHorizontalSmoothing(resized, pixelWidth)
    }
  }

  return resized
})

// 2. Extraction des données RGBA (utilise smoothedImageAtom au lieu de resizedImageAtom)
export const croppedBufferAtom = atom(async (get) => {
  const processed = await get(smoothedImageAtom)
  if (!processed) return null
  return extractBuffer(processed)
})

// 3. Construction du quantizer sans mémoïsation
export const quantizerAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const processed = await get(smoothedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = 'RGB' // Fixé sur RGB
  const cpcHardware = get(cpcHardwareAtom)
  if (!buf || !processed) return null

  const availableMetrics = DISTANCE_METRICS_BY_COLORSPACE[colorSpace]
  const distanceMetric = availableMetrics[0]

  const quantizer = createQuantizer({
    buf,
    basePalette: getPaletteForHardware(cpcHardware),
    preselected: lockedVecs,
    quantConfig: {
      distanceMetric
    }
  })
  return quantizer
})

// 4. Quantization avec palette adaptateur
export const reducedPaletteRawAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const processed = await get(smoothedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const cpcHardware = get(cpcHardwareAtom)

  if (!buf || !processed) return []

  const paletteProcessor = get(paletteProcessorAtom)
  if (!paletteProcessor) {
    logger.warn('Palette processor not initialized')
    return []
  }

  // DEBUG: Log des paramètres de quantification
  const basePalette = getPaletteForHardware(cpcHardware)

  // Utilisation du nombre de couleurs correct depuis l'optimisation CPC Plus
  const modeConfig = get(effectiveModeConfigAtom)
  // Compter les slots vides verrouillés pour tronquer le résultat après quantification
  const lockedEmptyCount = get(lockedEmptySlotsCountAtom)
  // Toujours demander le nombre maximum de couleurs pour garantir la stabilité de la palette
  // On tronquera le résultat après coup pour exclure les couleurs en trop
  const targetColors = modeConfig.nColors

  logger.info('[Preview] Target colors calculation', {
    modeNColors: modeConfig.nColors,
    lockedEmptyCount,
    targetColors,
    lockedVecsCount: lockedVecs.length
  })

  // Quantifier les couleurs lockées selon le hardware AVANT de les passer au quantizer
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

  const paletteStrategy = get(paletteStrategyAtom)

  logger.info('[Preview] Quantizing palette', {
    targetColors,
    paletteStrategy,
    hardware: cpcHardware
  })

  const palette = await paletteProcessor.quantizePalette(
    buf,
    processed,
    targetColors,
    basePalette,
    quantifiedLockedVecs,
    paletteStrategy // Utiliser la stratégie de sélection de palette choisie
  )

  logger.info('[Preview] Palette quantized', { colorsCount: palette.length })

  return palette
})

// 5. Image preview finale avec cache dithering optimisé
export const previewImageAtom = atom(async (get) => {
  const modeConfig = get(effectiveModeConfigAtom)
  const quantizer = await get(quantizerAtom)
  // Utiliser la palette avec slots pour que les indices correspondent à l'export
  const reduced = await get(exportPaletteWithSlotsAtom)
  // reducedRgb n'est plus nécessaire: le dithering retourne déjà du RGB
  const processed = await get(smoothedImageAtom)
  const dithering = get(ditheringAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom) // Get center option
  if (!quantizer || !processed) return null

  // En mode origin, l'image est déjà aux bonnes dimensions CPC (160x200, 320x200, 640x200)
  // On ne doit PAS appliquer getVisualRegionNormalized qui re-scale avec le pixel aspect ratio
  const normalized =
    resizeMode === 'origin'
      ? processed // Utiliser directement l'image sans normalisation
      : getVisualRegionNormalized(processed, modeConfig)

  if (!normalized) return null

  const previewBuffer = quantizer.dither(normalized, reduced, {
    mode: dithering.mode,
    intensity: dithering.intensity
  })

  // Le dithering retourne déjà un buffer RGB, pas besoin de remapping!
  // Le remapImageDataToPalette était utilisé avant quand on avait des indices
  const remapped = new ImageData(
    new Uint8ClampedArray(previewBuffer),
    normalized.width,
    normalized.height
  )

  // Positionnement pour le mode auto (origin gère son propre centrage)
  // En mode auto, getVisualRegionNormalized retourne une ImageData de taille variable (scaledW × scaledH)
  // qu'il faut placer dans un canvas à la taille cible (160x200 ou 320x200)
  if (resizeMode === 'auto') {
    const positioned = positionImageForAutoMode(
      remapped,
      modeConfig,
      reduced,
      centerImage
    )
    return positioned
  }

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
  const lockedEmptyCount = get(lockedEmptySlotsCountAtom)

  logger.info('[Preview] reducedPaletteRgbAtom', {
    rawLength: raw.length,
    modeNColors: modeConfig.nColors,
    lockedEmptyCount
  })

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
  // Tenir compte des slots vides verrouillés pour tronquer la palette
  const effectiveMaxColors = modeConfig.nColors - lockedEmptyCount
  if (projected.length > effectiveMaxColors) {
    // Tronquer pour exclure les couleurs en trop (slots vides verrouillés)
    projected.splice(effectiveMaxColors)
  }

  return projected
})

// Palette pour l'export: reconstruit la palette complète avec les slots vides lockés
// Les slots vides lockés sont remplis avec la couleur la plus sombre de la palette
// pour maintenir la correspondance des indices lors de l'export
export const exportPaletteWithSlotsAtom = atom(async (get) => {
  const reducedPalette = await get(reducedPaletteRgbAtom)
  const userPalette = get(userPaletteAtom)
  const modeConfig = get(effectiveModeConfigAtom)

  if (reducedPalette.length === 0) {
    return []
  }

  // Trouver la couleur la plus sombre pour remplir les slots vides
  const darkestColor = reducedPalette.reduce((darkest, color) => {
    const colorLuminance = luminance(color)
    const darkestLuminance = luminance(darkest)
    return colorLuminance < darkestLuminance ? color : darkest
  }, reducedPalette[0])

  // Reconstruire la palette complète avec les slots vides à leur position
  const fullPalette: Vector[] = []
  let reducedIndex = 0

  for (let i = 0; i < modeConfig.nColors; i++) {
    const slot = userPalette[i]
    if (slot?.locked && slot.color === null) {
      // Slot vide locké: utiliser la couleur la plus sombre comme placeholder
      fullPalette.push(darkestColor)
    } else if (reducedIndex < reducedPalette.length) {
      // Slot avec couleur: utiliser la couleur de la palette réduite
      fullPalette.push(reducedPalette[reducedIndex])
      reducedIndex++
    } else {
      // Pas assez de couleurs: remplir avec la couleur la plus sombre
      fullPalette.push(darkestColor)
    }
  }

  logger.info('[Preview] exportPaletteWithSlotsAtom', {
    reducedPaletteLength: reducedPalette.length,
    fullPaletteLength: fullPalette.length,
    lockedEmptySlots: userPalette
      .slice(0, modeConfig.nColors)
      .map((s, i) => ({ i, isEmpty: s.locked && s.color === null }))
      .filter((s) => s.isEmpty)
  })

  return fullPalette
})

// Helper functions pour réduire la complexité cognitive
function positionImageForAutoMode(
  remapped: ImageData,
  modeConfig: any,
  reduced: any[],
  centerImage: boolean
): ImageData {
  const targetWidth = modeConfig.width
  const targetHeight = modeConfig.height

  if (remapped.width === targetWidth && remapped.height === targetHeight) {
    return remapped
  }

  const positionedCanvas = document.createElement('canvas')
  positionedCanvas.width = targetWidth
  positionedCanvas.height = targetHeight
  const ctx = positionedCanvas.getContext('2d')
  if (!ctx) {
    return remapped
  }

  // Find darkest color using Rec. 709 luminance
  const darkestColor = reduced.reduce((darkest, color) => {
    const colorLuminance = luminance(color)
    const darkestLuminance = luminance(darkest)
    return colorLuminance < darkestLuminance ? color : darkest
  }, reduced[0])

  ctx.fillStyle = `rgb(${darkestColor[0]}, ${darkestColor[1]}, ${darkestColor[2]})`
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  const dx = centerImage ? Math.floor((targetWidth - remapped.width) / 2) : 0
  const dy = centerImage ? Math.floor((targetHeight - remapped.height) / 2) : 0

  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = remapped.width
  tempCanvas.height = remapped.height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) {
    return remapped
  }
  tempCtx.putImageData(remapped, 0, 0)

  ctx.drawImage(tempCanvas, dx, dy)

  const positioned = ctx.getImageData(0, 0, targetWidth, targetHeight)
  return positioned
}
