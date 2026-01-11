/**
 * Index buffer atoms for preview pipeline.
 *
 * Handles conversion from preview image to index buffer:
 * - Base index buffer from preview image
 * - Final index buffer with manual edits applied
 * - Final preview image from index buffer
 * - Preview version tracking for edit invalidation
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import { rgbToIndexBufferExact } from '@/export'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { luminance } from '@/libs/pixsaur-color/src/utils/luminance'
import { applyManualEditsToBuffer, manualPixelEditsAtom } from './manual-edits'
import { exportPaletteWithSlotsAtom } from './palette-export'
import { previewImageAtom } from './preview-image'

// ============================================================================
// INDEX BUFFER
// ============================================================================

/**
 * Index buffer of the preview image.
 * Each pixel is represented by its palette index (0-15).
 * Used for raster rendering (palette modification per line).
 */
export const previewIndexBufferAtom = atom(async (get) => {
  const previewImage = await get(previewImageAtom)
  const exportPalette = await get(exportPaletteWithSlotsAtom)

  if (!previewImage || exportPalette.length === 0) {
    return null
  }

  // Prepare palette for mapping: replace ignored slots [-1,-1,-1]
  // with a valid color (black) for mapping to work
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

  // Convert ImageData to index buffer
  // rgbToIndexBufferExact expects Uint8ClampedArray (RGBA data)
  // 3rd param (quantize) must be false since image is already quantized
  // 4th param (fallbackToDarkest) must be true to handle unmapped pixels
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
// PREVIEW VERSION & FINAL PREVIEW
// ============================================================================

/**
 * Preview version (before manual edits).
 * Increments on each parameter change affecting preview.
 * Used to detect when manual edits should be cleared.
 */
export const previewVersionAtom = atom(async (get) => {
  // Depends on all atoms affecting preview
  await get(previewIndexBufferAtom)
  // Return timestamp for unique value on each recalculation
  return Date.now()
})

/**
 * Final index buffer with manual edits applied.
 * This atom should be used for preview rendering.
 */
export const finalPreviewIndexBufferAtom = atom(async (get) => {
  const baseData = await get(previewIndexBufferAtom)
  if (!baseData) return null

  const edits = get(manualPixelEditsAtom)
  return applyManualEditsToBuffer(baseData, edits)
})

/**
 * Final preview image with manual edits applied.
 * Converts finalPreviewIndexBufferAtom to ImageData for display.
 */
export const finalPreviewImageAtom = atom(async (get) => {
  const bufferData = await get(finalPreviewIndexBufferAtom)
  if (!bufferData) return null

  const { buffer, width, height, palette } = bufferData

  // Create ImageData from index buffer and palette
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
