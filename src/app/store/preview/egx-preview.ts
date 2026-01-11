/**
 * EGX Preview Atoms
 *
 * Handles the line-by-line mode alternation preview pipeline for EGX.
 * EGX alternates video modes per line (spatial interlacing, no flicker).
 *
 * IMPORTANT: This implementation reuses the standard quantizer's palette
 * and dithering infrastructure, applying EGX constraints only at render time.
 */

import { atom } from 'jotai'
import type { CpcModeConfig } from '@/app/store/config/types'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig, EGXType } from '@/libs/pixsaur-egx'
import {
  applyEGXDitheringByMode,
  colorDistanceSquared,
  findClosestInSubset,
  getMaxColorIndex,
  getModeForLine,
  getSharedColorCount
} from '@/libs/pixsaur-egx'
import {
  applyHorizontalSmoothing,
  getPixelWidthForMode,
  getVisualRegionNormalized
} from '@/preview'
import { applyResize, type Selection } from '@/source'
import {
  centerImageAtom,
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  egxEnabledAtom,
  egxFirstLineModeAtom,
  egxPreviewModeAtom,
  egxTypeAtom,
  horizontalSmoothingAtom,
  resizeModeAtom
} from '../config/config'
import { selectionAtom, workingImageAtom } from '../image/image'
import { userPaletteAtom } from '../palette/palette'
import type { PaletteSlot } from '../palette/types'
import {
  applyManualEditsToBuffer,
  exportPaletteWithSlotsAtom,
  manualPixelEditsAtom,
  positionImageForAutoMode
} from './preview'

// ============================================================================
// EGX Configuration Atom
// ============================================================================

/**
 * Derived EGX configuration from individual settings
 */
export const egxConfigAtom = atom((get): EGXConfig => {
  const type = get(egxTypeAtom)
  const firstLineMode = get(egxFirstLineModeAtom)
  const hardware = get(cpcHardwareAtom)
  const dithering = get(ditheringAtom)

  const ditheringEnabled = dithering.mode !== 'none'
  const ditheringIntensity = ditheringEnabled
    ? Math.round(dithering.intensity * 100)
    : 0

  return {
    type,
    firstLineMode,
    targetHardware: hardware,
    ditheringMode: ditheringEnabled ? dithering.mode : 'none',
    ditheringIntensity
  }
})

// ============================================================================
// EGX Mode Config Helper
// ============================================================================

/**
 * Get the CPC mode config for EGX based on the high-resolution mode.
 * EGX1: Uses Mode 1 dimensions (320×200 standard, 384×280 overscan)
 * EGX2: Uses Mode 2 dimensions (640×200 standard, 768×280 overscan)
 */
function getEGXModeConfig(
  egxType: EGXType,
  baseModeConfig: CpcModeConfig
): CpcModeConfig {
  // EGX uses the high-resolution mode dimensions
  // EGX1: Mode 1 (320px wide), EGX2: Mode 2 (640px wide)
  const highResMode = egxType === 'egx1' ? 1 : 2

  // Calculate width based on the high-res mode
  // Mode 0: 160px, Mode 1: 320px, Mode 2: 640px
  // The ratio is: Mode 1 = 2× Mode 0, Mode 2 = 4× Mode 0
  const widthMultiplier = egxType === 'egx1' ? 2 : 4
  const getModeMultiplier = (mode: number) => {
    if (mode === 0) return 1
    if (mode === 1) return 2
    return 4
  }
  const modeMultiplier = getModeMultiplier(baseModeConfig.mode)
  const baseWidthMode0 = baseModeConfig.width / modeMultiplier
  const egxWidth = Math.round(baseWidthMode0 * widthMultiplier)

  return {
    ...baseModeConfig,
    mode: highResMode,
    width: egxWidth,
    // EGX has square-ish pixels (no horizontal stretching)
    scaleX: 1,
    scaleY: egxType === 'egx1' ? 1 : 2, // Mode 2 has tall pixels
    // EGX1: 16 colors (like Mode 0), EGX2: 4 colors (like Mode 1)
    nColors: egxType === 'egx1' ? 16 : 4
  }
}

/**
 * Atom that provides the effective mode config for EGX.
 * Uses high-resolution mode dimensions.
 */
export const egxModeConfigAtom = atom((get): CpcModeConfig | null => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const egxType = get(egxTypeAtom)
  const baseModeConfig = get(effectiveModeConfigAtom)

  return getEGXModeConfig(egxType, baseModeConfig)
})

// ============================================================================
// EGX Normalized Image
// ============================================================================

/**
 * Image resized and normalized to EGX dimensions (high-resolution mode).
 * Uses the source image (not the standard pipeline's resized image)
 * to ensure correct dimensions:
 * - EGX1: 320×200 (or overscan equivalent)
 * - EGX2: 640×200 (or overscan equivalent)
 */
export const egxNormalizedImageAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const egxModeConfig = get(egxModeConfigAtom)
  const workingImage = await get(workingImageAtom)
  const selection = get(selectionAtom)
  const resizeMode = get(resizeModeAtom)
  const centerImage = get(centerImageAtom)
  const horizontalSmoothing = get(horizontalSmoothingAtom)
  const palette = await get(exportPaletteWithSlotsAtom)

  if (!egxModeConfig || !workingImage || !selection) return null

  // 1. Crop the selection from the working image
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = selection.width
  cropCanvas.height = selection.height
  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) return null

  // Put the working image on a temp canvas to extract the selection
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = workingImage.width
  tempCanvas.height = workingImage.height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return null
  tempCtx.putImageData(workingImage, 0, 0)

  // Extract the selection
  cropCtx.drawImage(
    tempCanvas,
    selection.sx,
    selection.sy,
    selection.width,
    selection.height,
    0,
    0,
    selection.width,
    selection.height
  )

  // 2. Resize based on mode
  let resizedImageData: ImageData

  if (resizeMode === 'origin') {
    // Mode origin: use applyResize which handles the pixel ratio
    const relativeSelection: Selection = {
      sx: 0,
      sy: 0,
      width: selection.width,
      height: selection.height
    }

    let resizedCanvas: HTMLCanvasElement
    try {
      resizedCanvas = applyResize(
        cropCanvas,
        relativeSelection,
        {
          mode: resizeMode,
          modeConfig: egxModeConfig
        },
        centerImage
      )
    } catch {
      logger.warn('[EGX] Failed to resize image')
      return null
    }

    const resizedCtx = resizedCanvas.getContext('2d')
    if (!resizedCtx) return null
    resizedImageData = resizedCtx.getImageData(
      0,
      0,
      resizedCanvas.width,
      resizedCanvas.height
    )
  } else {
    // Mode auto: normalize to EGX dimensions using getVisualRegionNormalized
    const croppedImageData = cropCtx.getImageData(
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    )
    const normalized = getVisualRegionNormalized(
      croppedImageData,
      egxModeConfig
    )
    if (!normalized) {
      logger.warn('[EGX] Failed to normalize image')
      return null
    }

    // Position in target dimensions (adds margins with darkest color)
    resizedImageData = positionImageForAutoMode(
      normalized,
      egxModeConfig,
      palette,
      centerImage
    )
  }

  // 3. Apply horizontal smoothing if enabled
  if (horizontalSmoothing) {
    const pixelWidth = getPixelWidthForMode(egxModeConfig.mode)
    resizedImageData = applyHorizontalSmoothing(resizedImageData, pixelWidth)
  }

  logger.info('[EGX] Normalized image', {
    width: resizedImageData.width,
    height: resizedImageData.height,
    targetWidth: egxModeConfig.width,
    targetHeight: egxModeConfig.height
  })

  return resizedImageData
})

// ============================================================================
// EGX Palette Optimization
// ============================================================================

/**
 * Analyze color usage on high-resolution lines to determine
 * which colors should be in the shared slots (INK 0-3 for EGX1, INK 0-1 for EGX2)
 */
function analyzeHighResLineColors(
  imageData: ImageData,
  palette: Vector<'RGB'>[],
  config: EGXConfig
): Map<number, number> {
  const colorUsage = new Map<number, number>()
  const { width, height } = imageData
  const data = imageData.data

  // Initialize usage counts
  for (let i = 0; i < palette.length; i++) {
    colorUsage.set(i, 0)
  }

  // Analyze only high-resolution lines
  for (let y = 0; y < height; y++) {
    const isHighResLine =
      (config.firstLineMode === 'low' && y % 2 !== 0) ||
      (config.firstLineMode === 'high' && y % 2 === 0)

    if (!isHighResLine) continue

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const pixel: Vector<'RGB'> = [data[idx], data[idx + 1], data[idx + 2]]

      // Find closest color in palette
      let bestIndex = 0
      let bestDist = Infinity
      for (let i = 0; i < palette.length; i++) {
        const dist = colorDistanceSquared(pixel, palette[i])
        if (dist < bestDist) {
          bestDist = dist
          bestIndex = i
        }
      }

      colorUsage.set(bestIndex, (colorUsage.get(bestIndex) ?? 0) + 1)
    }
  }

  return colorUsage
}

/**
 * Reorder palette so that the most used colors on high-res lines
 * are in the shared slots (first N positions).
 *
 * Also ensures color diversity: if two selected colors are too similar,
 * the second one is replaced by the next most-used distinct color.
 */
function optimizePaletteForEGX(
  palette: Vector<'RGB'>[],
  colorUsage: Map<number, number>,
  sharedCount: number,
  isPlus: boolean = false
): Vector<'RGB'>[] {
  // Sort color indices by usage (descending)
  const sortedIndices = [...colorUsage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx]) => idx)

  // Amélioration : tester toutes les combinaisons des 8 couleurs les plus utilisées pour les slots partagés
  const topIndices = sortedIndices.slice(0, Math.max(8, sharedCount))
  let bestScore = -Infinity
  let bestCombo: number[] = []

  // Génère toutes les combinaisons possibles de sharedCount parmi topIndices
  function* combinations(arr: number[], k: number): Generator<number[]> {
    const n = arr.length
    if (k > n) return
    const indices = Array.from({ length: k }, (_, i) => i)
    while (true) {
      yield indices.map((i) => arr[i])
      let i = k - 1
      while (i >= 0 && indices[i] === n - k + i) i--
      if (i < 0) break
      indices[i]++
      for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1
    }
  }

  // Contraintes de distance uniquement pour CPC Plus (palette 12-bit plus fine)
  const MIN_DISTANCE_SQ = isPlus ? 100 * 100 : 0 // Minimum 100 RGB units pour Plus
  const MIN_LUMINANCE_DIFF = 40 // Différence de luminance minimale pour deux couleurs sombres

  // Calcule la luminance perçue (formule standard)
  const getLuminance = (c: Vector<'RGB'>): number =>
    0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

  // Vérifie si deux couleurs sont perceptuellement trop proches (uniquement pour Plus)
  const areTooClose = (c1: Vector<'RGB'>, c2: Vector<'RGB'>): boolean => {
    if (!isPlus) return false // Pas de contrainte pour Classic

    const distSq = colorDistanceSquared(c1, c2)
    if (distSq >= MIN_DISTANCE_SQ) return false

    // Pour les couleurs sombres, exiger aussi une différence de luminance
    const lum1 = getLuminance(c1)
    const lum2 = getLuminance(c2)
    if (lum1 < 80 && lum2 < 80) {
      // Les deux sont sombres : vérifier la différence de luminance
      return Math.abs(lum1 - lum2) < MIN_LUMINANCE_DIFF
    }
    return true
  }

  for (const combo of combinations(topIndices, sharedCount)) {
    // Vérifie la contrainte de distance minimale
    let valid = true
    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        if (areTooClose(palette[combo[i]], palette[combo[j]])) {
          valid = false
          break
        }
      }
      if (!valid) break
    }
    if (!valid) continue

    // Score = 0.7*couverture + 0.3*contraste
    let coverage = 0
    for (const idx of combo) coverage += colorUsage.get(idx) ?? 0
    let contrast = 0
    let pairs = 0
    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        contrast += colorDistanceSquared(palette[combo[i]], palette[combo[j]])
        pairs++
      }
    }
    contrast = pairs > 0 ? contrast / pairs : 0
    const score = 0.7 * coverage + 0.3 * contrast
    if (score > bestScore) {
      bestScore = score
      bestCombo = combo
    }
  }

  // Si aucune combinaison trouvée, fallback avec contrainte de distance
  if (bestCombo.length === 0) {
    // Sélectionne les couleurs les plus utilisées en respectant la distance minimale
    for (const idx of topIndices) {
      if (bestCombo.length >= sharedCount) break
      const candidate = palette[idx]
      const isTooClose = bestCombo.some((selectedIdx) =>
        areTooClose(candidate, palette[selectedIdx])
      )
      if (!isTooClose) {
        bestCombo.push(idx)
      }
    }
    // Si toujours pas assez, remplir avec les plus utilisées restantes
    for (const idx of topIndices) {
      if (bestCombo.length >= sharedCount) break
      if (!bestCombo.includes(idx)) {
        bestCombo.push(idx)
      }
    }
  }

  // Build remaining indices (colors not selected for shared slots)
  const remainingIndices = sortedIndices.filter(
    (idx) => !bestCombo.includes(idx)
  )

  // Build optimized palette
  const optimized: Vector<'RGB'>[] = []
  // First: shared colors (meilleure combinaison)
  for (const idx of bestCombo) {
    optimized.push(palette[idx])
  }

  // Then: remaining colors
  for (const idx of remainingIndices) {
    optimized.push(palette[idx])
  }

  // Pad with black if needed
  while (optimized.length < palette.length) {
    optimized.push([0, 0, 0])
  }

  return optimized
}

// ============================================================================
// EGX Palette from Standard Quantizer
// ============================================================================

/**
 * Use the standard quantizer's palette for EGX.
 * Optimizes the palette so that the most used colors on high-res lines
 * are in the shared slots (INK 0-3 for EGX1, INK 0-1 for EGX2).
 * Locked colors are preserved at their positions.
 *
 * EGX1 needs 16 colors, EGX2 needs 4 colors.
 */
export const egxPaletteAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const config = get(egxConfigAtom)
  const normalizedImage = await get(egxNormalizedImageAtom)
  const userPalette = get(userPaletteAtom)

  // EGX1 et EGX2 utilisent la palette générée par le quantizer standard (qui utilise la palette strategy)
  const standardPalette = await get(exportPaletteWithSlotsAtom)
  if (!standardPalette || standardPalette.length === 0) {
    logger.warn('[EGX] No standard palette available')
    return null
  }
  const validColors = standardPalette.filter(
    (c): c is Vector<'RGB'> => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
  )

  const neededColors = config.type === 'egx1' ? 16 : 4
  const sharedCount = getSharedColorCount(config.type)

  // Identify locked slot indices (within neededColors range)
  const lockedIndices = new Set<number>()
  for (let i = 0; i < neededColors; i++) {
    if (userPalette[i]?.locked && userPalette[i]?.color) {
      lockedIndices.add(i)
    }
  }

  // Build initial palette with locked colors at their positions
  const colors: Vector<'RGB'>[] = new Array(neededColors).fill(null)

  // Place locked colors first
  for (const idx of lockedIndices) {
    const lockedColor = userPalette[idx]?.color
    if (lockedColor) {
      colors[idx] = lockedColor
    }
  }

  // Fill remaining slots with non-locked colors from validColors
  let validIdx = 0
  for (let i = 0; i < neededColors; i++) {
    if (colors[i] === null) {
      // Find next valid color that's not a duplicate of a locked color
      while (validIdx < validColors.length) {
        const color = validColors[validIdx]
        validIdx++
        // Check if this color is too similar to any locked color
        const isSimilarToLocked = [...lockedIndices].some((lockedIdx) => {
          const locked = colors[lockedIdx]
          if (!locked) return false
          return colorDistanceSquared(color, locked) < 100 // Very similar
        })
        if (!isSimilarToLocked) {
          colors[i] = color
          break
        }
      }
      // If we ran out of colors, use black
      colors[i] ??= [0, 0, 0]
    }
  }

  // Optimize palette for high-res lines, but preserve locked positions
  if (
    normalizedImage &&
    colors.length > sharedCount &&
    lockedIndices.size === 0
  ) {
    // Only reorder if no colors are locked (to preserve user's explicit choices)
    const colorUsage = analyzeHighResLineColors(normalizedImage, colors, config)
    const isPlus = config.targetHardware === 'plus'
    const optimizedColors = optimizePaletteForEGX(
      colors,
      colorUsage,
      sharedCount,
      isPlus
    )

    // Copy optimized colors back
    for (let i = 0; i < optimizedColors.length; i++) {
      colors[i] = optimizedColors[i]
    }

    logger.info('[EGX] Palette optimized for high-res lines', {
      sharedCount,
      topColors: colors.slice(0, sharedCount).map((c) => `rgb(${c.join(',')})`)
    })
  } else if (lockedIndices.size > 0) {
    logger.info('[EGX] Palette has locked colors, skipping optimization', {
      lockedIndices: [...lockedIndices]
    })
  }

  logger.info('[EGX] Palette from standard quantizer', {
    validColorsCount: validColors.length,
    neededColors,
    sharedCount,
    lockedCount: lockedIndices.size
  })

  return {
    colors,
    sharedColorCount: sharedCount,
    stats: {
      colorsUsedLowMode: neededColors,
      colorsUsedHighMode: sharedCount,
      avgErrorLowMode: 0,
      avgErrorHighMode: 0,
      totalError: 0
    }
  }
})

/**
 * Display palette for EGX mode (for ColorPalette component).
 * Returns the reordered EGX palette as PaletteSlot array.
 * Preserves locked colors from userPaletteAtom.
 */
export const egxDisplayPaletteAtom = atom(
  async (get): Promise<PaletteSlot[]> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return []

    const paletteInfo = await get(egxPaletteAtom)
    const userPalette = get(userPaletteAtom)
    if (!paletteInfo) return []

    const { colors: egxColors } = paletteInfo
    const neededColors = egxColors.length

    // Collect locked colors to filter them from EGX colors
    const lockedColors: Vector<'RGB'>[] = []
    for (let i = 0; i < 16; i++) {
      const slot = userPalette[i]
      if (slot?.locked && slot?.color) {
        lockedColors.push(slot.color)
      }
    }

    // Filter EGX colors to exclude those too similar to locked colors
    const availableEgxColors = egxColors.filter((color) => {
      return !lockedColors.some(
        (locked) => colorDistanceSquared(color, locked) < 100
      )
    })

    // Build display slots, preserving locked colors from user palette
    const slots: PaletteSlot[] = []
    let egxColorIndex = 0

    for (let i = 0; i < 16; i++) {
      const userSlot = userPalette[i]

      if (userSlot?.locked) {
        // Slot is locked: keep user's color and locked state
        slots.push({ ...userSlot })
      } else if (
        i < neededColors &&
        egxColorIndex < availableEgxColors.length
      ) {
        // Slot is not locked: use EGX optimized color (filtered)
        slots.push({
          color: availableEgxColors[egxColorIndex],
          locked: false
        })
        egxColorIndex++
      } else {
        // No more colors available
        slots.push({ color: null, locked: false })
      }
    }

    return slots
  }
)

// ============================================================================
// EGX Preview Image Helpers
// ============================================================================

function shouldGrayOut(previewMode: string, isLowResLine: boolean): boolean {
  return (
    (previewMode === 'lowLines' && !isLowResLine) ||
    (previewMode === 'highLines' && isLowResLine)
  )
}

// ============================================================================
// EGX Preview Image
// ============================================================================

/**
 * Generate EGX preview using EGX-aware dithering.
 *
 * Key improvement: The dithering is done with line-by-line palette constraints,
 * so error diffusion is computed with the actual colors available for each line.
 * This avoids the "double quantization" problem of the previous approach.
 *
 * Uses egxNormalizedImageAtom for correct EGX dimensions:
 * - EGX1: 320×200 (or overscan/custom equivalent)
 * - EGX2: 640×200 (or overscan/custom equivalent)
 */
export const egxPreviewImageAtom = atom(
  async (get): Promise<ImageData | null> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return null

    const config = get(egxConfigAtom)
    const paletteInfo = await get(egxPaletteAtom)
    const normalized = await get(egxNormalizedImageAtom)
    const dithering = get(ditheringAtom)

    if (!paletteInfo || !normalized) {
      logger.warn('[EGX] Missing dependencies for preview')
      return null
    }

    const previewMode = get(egxPreviewModeAtom)
    const { colors: palette } = paletteInfo

    const width = normalized.width
    const height = normalized.height

    logger.info('[EGX] Generating preview with EGX-aware dithering', {
      mode: previewMode,
      ditheringMode: dithering.mode,
      type: config.type,
      dimensions: `${width}x${height}`,
      paletteSize: palette.length
    })

    // Apply EGX-aware dithering (respects line palette constraints during dithering)
    const ditheredBuffer = applyEGXDitheringByMode(
      normalized,
      palette,
      config,
      dithering.mode,
      dithering.intensity
    )

    // If preview mode requires masking lines, apply it
    if (previewMode === 'lowLines' || previewMode === 'highLines') {
      const output = new Uint8ClampedArray(ditheredBuffer)

      for (let y = 0; y < height; y++) {
        const isLowResLine =
          (config.firstLineMode === 'low' && y % 2 === 0) ||
          (config.firstLineMode === 'high' && y % 2 !== 0)

        if (shouldGrayOut(previewMode, isLowResLine)) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4
            output[idx] = 0
            output[idx + 1] = 0
            output[idx + 2] = 0
          }
        }
      }

      return new ImageData(output, width, height)
    }

    // Create a new Uint8ClampedArray with a regular ArrayBuffer to satisfy ImageData requirements
    return new ImageData(new Uint8ClampedArray(ditheredBuffer), width, height)
  }
)

// ============================================================================
// EGX Index Buffer for Editor
// ============================================================================

/**
 * Generate EGX index buffer for the preview editor.
 * Maps each pixel to its palette index, respecting EGX line constraints.
 */
export const egxIndexBufferAtom = atom(
  async (
    get
  ): Promise<{
    buffer: Uint8Array
    width: number
    height: number
    palette: Vector<'RGB'>[]
  } | null> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return null

    const config = get(egxConfigAtom)
    const paletteInfo = await get(egxPaletteAtom)
    const normalized = await get(egxNormalizedImageAtom)
    const dithering = get(ditheringAtom)

    if (!paletteInfo || !normalized) {
      return null
    }

    const { colors: palette } = paletteInfo
    const width = normalized.width
    const height = normalized.height

    // Apply EGX-aware dithering to get the RGBA buffer
    const ditheredBuffer = applyEGXDitheringByMode(
      normalized,
      palette,
      config,
      dithering.mode,
      dithering.intensity
    )

    // Convert RGBA to index buffer
    // On low-res lines, pixels are grouped by 2 and must have the same color
    const indexBuffer = new Uint8Array(width * height)

    // High-res mode for this EGX type (Mode 1 for EGX1, Mode 2 for EGX2)
    const highResMode = config.type === 'egx1' ? 1 : 2

    for (let y = 0; y < height; y++) {
      const lineMode = getModeForLine(y, config)
      const maxColorIndex = getMaxColorIndex(lineMode, config.type)
      const isLowResLine = lineMode !== highResMode

      // On low-res lines, process pixels in pairs
      const step = isLowResLine ? 2 : 1

      for (let x = 0; x < width; x += step) {
        if (isLowResLine && x + 1 < width) {
          // Low-res line: average the two pixels and use same color for both
          const pixelIdx1 = y * width + x
          const pixelIdx2 = y * width + x + 1
          const rgbaIdx1 = pixelIdx1 * 4
          const rgbaIdx2 = pixelIdx2 * 4

          // Average the two pixels
          const avgPixel: Vector<'RGB'> = [
            Math.round(
              (ditheredBuffer[rgbaIdx1] + ditheredBuffer[rgbaIdx2]) / 2
            ),
            Math.round(
              (ditheredBuffer[rgbaIdx1 + 1] + ditheredBuffer[rgbaIdx2 + 1]) / 2
            ),
            Math.round(
              (ditheredBuffer[rgbaIdx1 + 2] + ditheredBuffer[rgbaIdx2 + 2]) / 2
            )
          ]

          // Find index in sub-palette
          const { index } = findClosestInSubset(
            avgPixel,
            palette,
            maxColorIndex
          )

          // Assign same index to both pixels
          indexBuffer[pixelIdx1] = index
          indexBuffer[pixelIdx2] = index
        } else {
          // High-res line or last pixel on odd-width low-res line
          const pixelIdx = y * width + x
          const rgbaIdx = pixelIdx * 4

          const pixel: Vector<'RGB'> = [
            ditheredBuffer[rgbaIdx],
            ditheredBuffer[rgbaIdx + 1],
            ditheredBuffer[rgbaIdx + 2]
          ]

          // Find index in sub-palette
          const { index } = findClosestInSubset(pixel, palette, maxColorIndex)
          indexBuffer[pixelIdx] = index
        }
      }
    }

    return {
      buffer: indexBuffer,
      width,
      height,
      palette
    }
  }
)

// ============================================================================
// Final EGX Atoms (with manual edits applied)
// ============================================================================

/**
 * Final EGX index buffer with manual edits applied.
 * This is the buffer that should be used for export in EGX mode.
 */
export const finalEgxIndexBufferAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const baseData = await get(egxIndexBufferAtom)
  if (!baseData) return null

  const edits = get(manualPixelEditsAtom)
  return applyManualEditsToBuffer(baseData, edits)
})

/**
 * Final EGX preview ImageData with manual edits applied.
 * Converts the finalEgxIndexBufferAtom to ImageData for display.
 * Also applies the preview mode masking (lowLines/highLines).
 */
export const finalEgxPreviewImageAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const bufferData = await get(finalEgxIndexBufferAtom)
  if (!bufferData) return null

  const { buffer, width, height, palette } = bufferData
  const previewMode = get(egxPreviewModeAtom)
  const config = get(egxConfigAtom)

  // Create ImageData from index buffer and palette
  const imageData = new ImageData(width, height)
  const data = imageData.data

  for (let y = 0; y < height; y++) {
    const isLowResLine =
      (config.firstLineMode === 'low' && y % 2 === 0) ||
      (config.firstLineMode === 'high' && y % 2 !== 0)

    // Check if this line should be masked
    const shouldMask = shouldGrayOut(previewMode, isLowResLine)

    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const pixelIndex = i * 4

      if (shouldMask) {
        // Black out masked lines
        data[pixelIndex] = 0
        data[pixelIndex + 1] = 0
        data[pixelIndex + 2] = 0
      } else {
        const inkIndex = buffer[i]
        const color = palette[inkIndex] ?? [0, 0, 0]
        data[pixelIndex] = color[0]
        data[pixelIndex + 1] = color[1]
        data[pixelIndex + 2] = color[2]
      }
      data[pixelIndex + 3] = 255
    }
  }

  return imageData
})

// ============================================================================
// EGX Export Data
// ============================================================================

/**
 * Export data for EGX mode.
 * Provides all data needed for exporting: index buffer, palette, and config.
 */
export const egxExportDataAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const bufferData = await get(finalEgxIndexBufferAtom)
  const config = get(egxConfigAtom)

  if (!bufferData) return null

  return {
    indexBuffer: bufferData.buffer,
    palette: bufferData.palette,
    width: bufferData.width,
    height: bufferData.height,
    config
  }
})
