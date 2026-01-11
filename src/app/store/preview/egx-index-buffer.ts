/**
 * EGX Index Buffer Generation
 *
 * Generates index buffers mapping pixels to palette indices for EGX mode.
 * Respects EGX line constraints (different palette subsets per line).
 */

import { atom } from 'jotai'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  applyEGXDitheringByMode,
  findClosestInSubset,
  getMaxColorIndex,
  getModeForLine
} from '@/libs/pixsaur-egx'
import { ditheringAtom, egxEnabledAtom } from '../config/config'
import { egxConfigAtom } from './egx-config'
import { egxNormalizedImageAtom } from './egx-image'
import { egxPaletteAtom } from './egx-palette'
import { applyManualEditsToBuffer, manualPixelEditsAtom } from './preview'

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
