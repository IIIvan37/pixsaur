import { atom } from 'jotai'
import { logger } from '@/core'
import { quantifyToCPCPlus, quantizeCPC, rgbToIndexBufferExact } from '@/export'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import {
  DISTANCE_METRICS_BY_COLORSPACE,
  weightedRGBDistance
} from '@/libs/pixsaur-color/src/metric/distance'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { luminance } from '@/libs/pixsaur-color/src/utils/luminance'
import type { CPCHardware } from '@/libs/types'
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
import type { PaletteSlot } from '../palette/types'

// ============================================================================
// Utilitaires pour le filtrage des couleurs lockées
// ============================================================================

// Seuil de distance minimale pour éviter les doublons visuels
const MIN_PERCEPTUAL_DISTANCE = 50

/**
 * Calcule la distance perceptuelle entre deux couleurs RGB
 */
function perceptualColorDistance(a: Vector, b: Vector): number {
  return Math.sqrt(weightedRGBDistance(a, b))
}

/**
 * Vérifie si une couleur est trop proche d'une des couleurs lockées
 */
function isColorTooCloseToLocked(
  color: Vector,
  lockedColors: Vector[]
): boolean {
  return lockedColors.some(
    (locked) => perceptualColorDistance(color, locked) < MIN_PERCEPTUAL_DISTANCE
  )
}

/**
 * Filtre les couleurs de reducedPalette qui sont trop proches des couleurs lockées
 */
function filterReducedPalette(
  reducedPalette: Vector[],
  lockedColors: Vector[]
): Vector[] {
  return reducedPalette.filter(
    (color) => !isColorTooCloseToLocked(color, lockedColors)
  )
}

/**
 * Extrait les couleurs des slots lockés (non vides)
 */
function extractLockedColors(userPalette: PaletteSlot[]): Vector[] {
  return userPalette
    .filter((slot) => slot.locked && slot.color)
    .map((slot) => slot.color!)
}

export const previewCanvasWidthAtom = atom<number | null>(null)

export const previewCanvasSizeAtom = atom((get) => {
  const containerWidth = get(previewCanvasWidthAtom)

  if (!containerWidth) return { width: 0, height: 0 }

  // Obtenir la configuration du mode CPC pour le pixel aspect ratio
  const modeConfig = get(effectiveModeConfigAtom)

  // Dimensions visuelles = dimensions canvas × pixel aspect ratio
  // Toujours 320×200 pour tous les modes
  const visualWidth = modeConfig.width * modeConfig.scaleX
  const visualHeight = modeConfig.height * modeConfig.scaleY

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

// 4b. Image normalisée aux dimensions CPC (avant dithering)
// Utilisée pour l'optimisation des rasters ligne par ligne
export const normalizedImageAtom = atom(async (get) => {
  const modeConfig = get(effectiveModeConfigAtom)
  const processed = await get(smoothedImageAtom)
  const resizeMode = get(resizeModeAtom)

  if (!processed) return null

  // En mode origin, l'image est déjà aux bonnes dimensions CPC
  // En mode auto, on normalise aux dimensions CPC
  const normalized =
    resizeMode === 'origin'
      ? processed
      : getVisualRegionNormalized(processed, modeConfig)

  return normalized
})

// 4c. Image normalisée positionnée (mêmes dimensions que previewImage)
// Utilisée pour l'optimisation des rasters - doit avoir exactement les mêmes
// dimensions que previewIndexBufferAtom pour que les indices correspondent
export const positionedNormalizedImageAtom = atom(async (get) => {
  const modeConfig = get(effectiveModeConfigAtom)
  const normalized = await get(normalizedImageAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)
  const exportPalette = await get(exportPaletteWithSlotsAtom)

  if (!normalized) return null

  // En mode auto, appliquer le même positionnement que previewImageAtom
  if (resizeMode === 'auto') {
    return positionImageForAutoMode(
      normalized,
      modeConfig,
      exportPalette,
      centerImage
    )
  }

  return normalized
})

/**
 * Effective dithering configuration.
 * Returns the user-configured dithering settings.
 * In raster mode, this dithering is applied AFTER raster optimization
 * using per-line palettes.
 */
export const effectiveDitheringAtom = atom((get) => {
  const dithering = get(ditheringAtom)
  return dithering
})

// 5. Image preview finale avec cache dithering optimisé
export const previewImageAtom = atom(async (get) => {
  const modeConfig = get(effectiveModeConfigAtom)
  const quantizer = await get(quantizerAtom)
  // Utiliser la palette avec slots pour que les indices correspondent à l'export
  const exportPalette = await get(exportPaletteWithSlotsAtom)
  // reducedRgb n'est plus nécessaire: le dithering retourne déjà du RGB
  const normalized = await get(normalizedImageAtom)
  const dithering = get(effectiveDitheringAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom) // Get center option
  if (!quantizer || !normalized) return null

  // Préparer la palette pour le dithering: remplacer les slots ignorés [-1,-1,-1]
  // par une couleur valide (noir) pour que le dithering fonctionne
  const validColors = exportPalette.filter(
    (c) => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
  )
  const fallbackColor: Vector =
    validColors.length > 0
      ? validColors.reduce((darkest, color) => {
          return luminance(color) < luminance(darkest) ? color : darkest
        }, validColors[0])
      : [0, 0, 0]

  // Palette pour le dithering: même structure que export mais avec fallback pour les ignorés
  const ditheringPalette = exportPalette.map((color) =>
    color[0] === -1 ? fallbackColor : color
  )

  const previewBuffer = quantizer.dither(normalized, ditheringPalette, {
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
      exportPalette,
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

// Atom pour l'affichage dans ColorPalette
// Combine l'état locked de userPaletteAtom avec les couleurs de reducedPaletteRgbAtom
// pour les slots non lockés
export const displayPaletteAtom = atom(async (get) => {
  const userPalette = get(userPaletteAtom)
  const reducedPalette = await get(reducedPaletteRgbAtom)
  const modeConfig = get(effectiveModeConfigAtom)

  // Filtrer les couleurs trop proches des couleurs lockées
  const lockedColors = extractLockedColors(userPalette)
  const filteredReduced = filterReducedPalette(reducedPalette, lockedColors)

  const displaySlots: PaletteSlot[] = []
  let reducedIndex = 0

  for (let i = 0; i < 16; i++) {
    const slot = userPalette[i]
    if (i >= modeConfig.nColors || slot?.locked) {
      // Hors du mode actuel ou slot locké: garder le slot tel quel
      displaySlots.push({ ...slot })
    } else if (reducedIndex < filteredReduced.length) {
      // Slot non locké: utiliser la couleur de filteredReduced
      const color = filteredReduced[reducedIndex]
      displaySlots.push({
        color: color,
        locked: false
      })
      reducedIndex++
    } else {
      // Slot non locké: pas de couleur disponible
      displaySlots.push({ color: null, locked: false })
    }
  }

  return displaySlots
})

// Valeur spéciale pour marquer un slot ignoré dans la palette d'export
export const IGNORED_SLOT: Vector = [-1, -1, -1]

// Palette pour l'export: reconstruit la palette complète avec les slots vides lockés
// Les slots vides lockés sont marqués avec IGNORED_SLOT [-1, -1, -1] pour indiquer qu'ils sont ignorés
// Helper pour quantifier une couleur selon le hardware CPC
function quantifyColorForHardware(
  color: Vector,
  cpcHardware: 'classic' | 'plus'
): Vector {
  const result = [...color] as Vector
  if (cpcHardware === 'classic') {
    result[0] = quantizeCPC(result[0])
    result[1] = quantizeCPC(result[1])
    result[2] = quantizeCPC(result[2])
  } else {
    result[0] = quantifyToCPCPlus(result[0])
    result[1] = quantifyToCPCPlus(result[1])
    result[2] = quantifyToCPCPlus(result[2])
  }
  return result
}

// Helper pour traiter un slot de palette
function processSlot(
  slot: PaletteSlot | undefined,
  filteredReduced: Vector[],
  reducedIndex: { value: number },
  darkestColor: Vector,
  cpcHardware: CPCHardware
): Vector {
  if (slot?.locked && slot.color === null) {
    return IGNORED_SLOT
  }
  if (slot?.locked && slot.color) {
    return quantifyColorForHardware(slot.color, cpcHardware)
  }
  if (reducedIndex.value < filteredReduced.length) {
    return filteredReduced[reducedIndex.value++]
  }
  return darkestColor
}

export const exportPaletteWithSlotsAtom = atom(async (get) => {
  const reducedPalette = await get(reducedPaletteRgbAtom)
  const userPalette = get(userPaletteAtom)
  const modeConfig = get(effectiveModeConfigAtom)
  const cpcHardware = get(cpcHardwareAtom)

  if (reducedPalette.length === 0) {
    return [] as Vector[]
  }

  // Trouver la couleur la plus sombre pour remplir les slots vides
  const darkestColor = reducedPalette.reduce((darkest, color) => {
    const colorLuminance = luminance(color)
    const darkestLuminance = luminance(darkest)
    return colorLuminance < darkestLuminance ? color : darkest
  }, reducedPalette[0])

  // Filtrer les couleurs trop proches des couleurs lockées
  const lockedColors = extractLockedColors(userPalette)
  const filteredReduced = filterReducedPalette(reducedPalette, lockedColors)

  // Reconstruire la palette complète en utilisant userPalette comme référence
  const fullPalette: Vector[] = []
  const reducedIndex = { value: 0 } // Compteur mutable pour parcourir filteredReduced

  for (let i = 0; i < modeConfig.nColors; i++) {
    fullPalette.push(
      processSlot(
        userPalette[i],
        filteredReduced,
        reducedIndex,
        darkestColor,
        cpcHardware
      )
    )
  }

  logger.info('[Preview] exportPaletteWithSlotsAtom', {
    reducedPaletteLength: reducedPalette.length,
    fullPaletteLength: fullPalette.length,
    lockedEmptySlots: userPalette
      .slice(0, modeConfig.nColors)
      .map((s, i) => ({ i, isEmpty: s.locked && s.color === null }))
      .filter((s) => s.isEmpty),
    palette: fullPalette.map((c, i) => ({ i, color: c }))
  })

  return fullPalette
})

// Helper functions pour réduire la complexité cognitive
function positionImageForAutoMode(
  remapped: ImageData,
  modeConfig: any,
  reduced: Vector[],
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

  // Filter out ignored slots [-1, -1, -1] for darkest color calculation
  const validColors = reduced.filter(
    (c) => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
  )
  const fallbackColor: Vector = [0, 0, 0]
  const colorsForDarkest =
    validColors.length > 0 ? validColors : [fallbackColor]

  // Find darkest color using Rec. 709 luminance
  const darkestColor = colorsForDarkest.reduce((darkest, color) => {
    const colorLuminance = luminance(color)
    const darkestLuminance = luminance(darkest)
    return colorLuminance < darkestLuminance ? color : darkest
  }, colorsForDarkest[0])

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

// ============================================================================
// Index Buffer pour les Rasters
// ============================================================================

/**
 * Index buffer de la preview image.
 * Chaque pixel est représenté par son indice dans la palette (0-15).
 * Utilisé pour le rendu avec rasters (modification de palette par ligne).
 */
export const previewIndexBufferAtom = atom(async (get) => {
  const previewImage = await get(previewImageAtom)
  const exportPalette = await get(exportPaletteWithSlotsAtom)

  if (!previewImage || exportPalette.length === 0) {
    return null
  }

  // Préparer la palette pour le mapping: remplacer les slots ignorés [-1,-1,-1]
  // par une couleur valide (noir) pour que le mapping fonctionne
  const validColors = exportPalette.filter(
    (c) => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
  )
  const fallbackColor: Vector =
    validColors.length > 0
      ? validColors.reduce((darkest, color) => {
          return luminance(color) < luminance(darkest) ? color : darkest
        }, validColors[0])
      : [0, 0, 0]

  const ditheringPalette = exportPalette.map((color) =>
    color[0] === -1 ? fallbackColor : color
  )

  // Convertir l'ImageData en index buffer
  // rgbToIndexBufferExact attend un Uint8ClampedArray (les données RGBA)
  // Le 3ème paramètre (quantize) doit être false car l'image est déjà quantifiée
  // Le 4ème paramètre (fallbackToDarkest) doit être true pour gérer les pixels non trouvés
  const indexBuffer = rgbToIndexBufferExact(
    previewImage.data,
    ditheringPalette,
    false,
    true
  )

  logger.info('[Preview] Index buffer created', {
    width: previewImage.width,
    height: previewImage.height,
    bufferLength: indexBuffer.length,
    paletteSize: ditheringPalette.length
  })

  return {
    buffer: indexBuffer,
    width: previewImage.width,
    height: previewImage.height,
    palette: ditheringPalette
  }
})

// ============================================================================
// Modifications manuelles de pixels
// ============================================================================

/**
 * Type représentant un index buffer avec ses métadonnées.
 */
export type IndexBufferData = {
  buffer: Uint8Array
  width: number
  height: number
  palette: Vector[]
}

/**
 * Applique les modifications manuelles à un index buffer.
 * @param baseBuffer - Le buffer de base (non modifié)
 * @param edits - Map des modifications "x,y" -> inkIndex
 * @returns Une copie du buffer avec les modifications appliquées, ou le buffer original si pas d'edits
 */
export function applyManualEditsToBuffer(
  baseBuffer: IndexBufferData,
  edits: Map<string, number>
): IndexBufferData {
  if (edits.size === 0) return baseBuffer

  const modifiedBuffer = new Uint8Array(baseBuffer.buffer)

  for (const [key, inkIndex] of edits) {
    const [x, y] = key.split(',').map(Number)
    const idx = y * baseBuffer.width + x
    if (idx >= 0 && idx < modifiedBuffer.length) {
      modifiedBuffer[idx] = inkIndex
    }
  }

  return {
    ...baseBuffer,
    buffer: modifiedBuffer
  }
}

/**
 * Version de la preview (avant edits manuels).
 * S'incrémente à chaque changement de paramètres affectant la preview.
 * Utilisé pour détecter quand les edits manuels doivent être effacés.
 */
export const previewVersionAtom = atom(async (get) => {
  // Dépend de tous les atomes qui affectent la preview
  await get(previewIndexBufferAtom)
  // Retourne un timestamp pour avoir une valeur unique à chaque recalcul
  return Date.now()
})

/**
 * Stocke les modifications manuelles de pixels (de l'éditeur de preview).
 * Map: "x,y" -> inkIndex
 * Réinitialisé quand l'image source ou la preview change.
 */
export const manualPixelEditsAtom = atom<Map<string, number>>(new Map())

/**
 * Indique s'il y a des modifications manuelles non sauvegardées.
 */
export const hasManualEditsAtom = atom(
  (get) => get(manualPixelEditsAtom).size > 0
)

/**
 * Nombre de modifications manuelles.
 */
export const manualEditsCountAtom = atom(
  (get) => get(manualPixelEditsAtom).size
)

/**
 * Action pour effacer toutes les modifications manuelles.
 */
export const clearManualEditsAtom = atom(null, (_get, set) => {
  set(manualPixelEditsAtom, new Map())
  logger.info('[Preview] Manual edits cleared')
})

/**
 * Action pour appliquer un buffer modifié complet.
 * Compare avec le buffer original fourni et stocke les différences.
 * @param editedBuffer - Le buffer modifié de l'éditeur
 * @param originalBuffer - Le buffer original (avant édition)
 * @param width - Largeur de l'image
 * @param height - Hauteur de l'image
 */
export const applyManualEditsAtom = atom(
  null,
  (
    _get,
    set,
    editedBuffer: Uint8Array,
    originalBuffer: Uint8Array,
    width: number,
    height: number
  ) => {
    const edits = new Map<string, number>()

    // Trouver les pixels modifiés
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (editedBuffer[idx] !== originalBuffer[idx]) {
          edits.set(`${x},${y}`, editedBuffer[idx])
        }
      }
    }

    set(manualPixelEditsAtom, edits)
    logger.info('[Preview] Manual edits applied', { editCount: edits.size })
  }
)

/**
 * Index buffer final avec les modifications manuelles appliquées.
 * C'est cet atome qui doit être utilisé pour le rendu de la preview.
 */
export const finalPreviewIndexBufferAtom = atom(async (get) => {
  const baseData = await get(previewIndexBufferAtom)
  if (!baseData) return null

  const edits = get(manualPixelEditsAtom)
  return applyManualEditsToBuffer(baseData, edits)
})

/**
 * Image preview finale avec les modifications manuelles appliquées.
 * Convertit le finalPreviewIndexBufferAtom en ImageData pour l'affichage.
 */
export const finalPreviewImageAtom = atom(async (get) => {
  const bufferData = await get(finalPreviewIndexBufferAtom)
  if (!bufferData) return null

  const { buffer, width, height, palette } = bufferData

  // Créer l'ImageData à partir de l'index buffer et de la palette
  const imageData = new ImageData(width, height)
  const data = imageData.data

  for (let i = 0; i < buffer.length; i++) {
    const inkIndex = buffer[i]
    const color = palette[inkIndex] ?? [0, 0, 0]
    const pixelIndex = i * 4
    data[pixelIndex] = color[0] // R
    data[pixelIndex + 1] = color[1] // G
    data[pixelIndex + 2] = color[2] // B
    data[pixelIndex + 3] = 255 // A
  }

  return imageData
})
