/**
 * EGX Preview Image Generation
 *
 * Generates the preview image with EGX-aware dithering.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import { applyEGXDitheringByMode } from '@/libs/pixsaur-egx'
import {
  ditheringAtom,
  egxEnabledAtom,
  egxPreviewModeAtom
} from '../config/config'
import { egxConfigAtom } from './egx-config'
import { egxNormalizedImageAtom } from './egx-image'
import { egxPaletteAtom } from './egx-palette'

/**
 * Helper to determine if a line should be grayed out based on preview mode
 */
export function shouldGrayOut(
  previewMode: string,
  isLowResLine: boolean
): boolean {
  return (
    (previewMode === 'lowLines' && !isLowResLine) ||
    (previewMode === 'highLines' && isLowResLine)
  )
}

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
