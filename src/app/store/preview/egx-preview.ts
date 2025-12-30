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
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import {
  getEGXOutputDimensions,
  getMaxColorIndex,
  getModeForLine,
  getSharedColorCount
} from '@/libs/pixsaur-egx'
import {
  cpcHardwareAtom,
  ditheringAtom,
  egxEnabledAtom,
  egxFirstLineModeAtom,
  egxPreviewModeAtom,
  egxTypeAtom,
  egxVerticalDitherAttenuationAtom
} from '../config/config'
import {
  exportPaletteWithSlotsAtom,
  normalizedImageAtom,
  quantizerAtom
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
  const verticalAttenuation = get(egxVerticalDitherAttenuationAtom)

  const ditheringEnabled = dithering.mode !== 'none'
  const ditheringIntensity = ditheringEnabled
    ? Math.round(dithering.intensity * 100)
    : 0

  return {
    type,
    firstLineMode,
    targetHardware: hardware,
    ditheringMode: ditheringEnabled ? dithering.mode : 'none',
    ditheringIntensity,
    verticalDitherAttenuation: verticalAttenuation
  }
})

// ============================================================================
// Color Distance Utilities
// ============================================================================

function colorDistanceSquared(a: Vector<'RGB'>, b: Vector<'RGB'>): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

function findClosestInSubset(
  target: Vector<'RGB'>,
  palette: Vector<'RGB'>[],
  maxIndex: number
): { index: number; color: Vector<'RGB'> } {
  let bestIndex = 0
  let bestDist = Infinity

  const limit = Math.min(maxIndex + 1, palette.length)
  for (let i = 0; i < limit; i++) {
    const dist = colorDistanceSquared(target, palette[i])
    if (dist < bestDist) {
      bestDist = dist
      bestIndex = i
    }
  }

  return { index: bestIndex, color: palette[bestIndex] }
}

// ============================================================================
// EGX Palette from Standard Quantizer
// ============================================================================

/**
 * Use the standard quantizer's palette for EGX.
 * EGX1 needs 16 colors, EGX2 needs 4 colors.
 */
export const egxPaletteAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const config = get(egxConfigAtom)
  const standardPalette = await get(exportPaletteWithSlotsAtom)

  if (!standardPalette || standardPalette.length === 0) {
    logger.warn('[EGX] No standard palette available')
    return null
  }

  // Filter out invalid colors ([-1,-1,-1] slots)
  const validColors = standardPalette.filter(
    (c): c is Vector<'RGB'> => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
  )

  const neededColors = config.type === 'egx1' ? 16 : 4
  const sharedCount = getSharedColorCount(config.type)

  // If we have enough colors, use them
  // If not, pad with black
  const colors: Vector<'RGB'>[] = []
  for (let i = 0; i < neededColors; i++) {
    colors.push(validColors[i] ?? [0, 0, 0])
  }

  logger.info('[EGX] Palette from standard quantizer', {
    validColorsCount: validColors.length,
    neededColors,
    sharedCount
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

// ============================================================================
// EGX Preview Image Helpers
// ============================================================================

function renderModeMapPixel(
  output: Uint8ClampedArray,
  dstIdx: number,
  isLowResLine: boolean
): void {
  if (isLowResLine) {
    output[dstIdx] = 200
    output[dstIdx + 1] = 120
    output[dstIdx + 2] = 50
  } else {
    output[dstIdx] = 50
    output[dstIdx + 1] = 100
    output[dstIdx + 2] = 200
  }
  output[dstIdx + 3] = 255
}

function renderGrayPixel(output: Uint8ClampedArray, dstIdx: number): void {
  output[dstIdx] = 128
  output[dstIdx + 1] = 128
  output[dstIdx + 2] = 128
  output[dstIdx + 3] = 255
}

function renderColorPixel(
  output: Uint8ClampedArray,
  dstIdx: number,
  color: Vector<'RGB'>
): void {
  output[dstIdx] = color[0]
  output[dstIdx + 1] = color[1]
  output[dstIdx + 2] = color[2]
  output[dstIdx + 3] = 255
}

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
 * Generate EGX preview by applying line-by-line constraints
 * to the dithered image from the standard pipeline.
 */
export const egxPreviewImageAtom = atom(
  async (get): Promise<ImageData | null> => {
    const egxEnabled = get(egxEnabledAtom)
    if (!egxEnabled) return null

    const config = get(egxConfigAtom)
    const paletteInfo = await get(egxPaletteAtom)
    const quantizer = await get(quantizerAtom)
    const normalized = await get(normalizedImageAtom)
    const dithering = get(ditheringAtom)

    if (!paletteInfo || !quantizer || !normalized) {
      logger.warn('[EGX] Missing dependencies for preview')
      return null
    }

    const previewMode = get(egxPreviewModeAtom)
    const { colors: palette } = paletteInfo

    // Get EGX output dimensions
    const dims = getEGXOutputDimensions(config.type)
    const { width, height } = dims

    logger.info('[EGX] Generating preview', {
      mode: previewMode,
      type: config.type,
      dimensions: `${width}x${height}`,
      paletteSize: palette.length
    })

    // Dither the normalized image with the full palette
    const ditheredBuffer = quantizer.dither(normalized, palette, {
      mode: dithering.mode,
      intensity: dithering.intensity
    })

    // Create output with EGX line constraints
    const output = new Uint8ClampedArray(width * height * 4)

    // Process each line according to its mode constraints
    for (let y = 0; y < height; y++) {
      const lineMode = getModeForLine(y, config)
      const maxColorIndex = getMaxColorIndex(lineMode, config.type)
      const isLowResLine =
        (config.firstLineMode === 'low' && y % 2 === 0) ||
        (config.firstLineMode === 'high' && y % 2 !== 0)

      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4
        const dstIdx = srcIdx

        const ditheredColor: Vector<'RGB'> = [
          ditheredBuffer[srcIdx],
          ditheredBuffer[srcIdx + 1],
          ditheredBuffer[srcIdx + 2]
        ]

        if (previewMode === 'modeMap') {
          renderModeMapPixel(output, dstIdx, isLowResLine)
        } else if (shouldGrayOut(previewMode, isLowResLine)) {
          renderGrayPixel(output, dstIdx)
        } else {
          const { color } = findClosestInSubset(
            ditheredColor,
            palette,
            maxColorIndex
          )
          renderColorPixel(output, dstIdx, color)
        }
      }
    }

    return new ImageData(output, width, height)
  }
)
