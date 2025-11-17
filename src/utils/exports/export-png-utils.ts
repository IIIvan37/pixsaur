/**
 * PNG Export Utilities
 * Shared functions for exporting PNG with different aspect ratios
 */

import type { CpcModeConfig } from '@/app/store/config/types'
import { getAspectRatioMultipliers } from '@/export'

/**
 * Create a canvas with native CPC dimensions (1:1 square pixels)
 * @param sourceCanvas Source canvas to resize
 * @param modeConfig CPC mode configuration
 * @returns Canvas with native CPC dimensions
 */
export function createSquarePixelsCanvas(
  sourceCanvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig
): HTMLCanvasElement {
  // Créer un canvas aux dimensions natives CPC (pixels carrés 1:1)
  const nativeCanvas = document.createElement('canvas')
  nativeCanvas.width = modeConfig.width
  nativeCanvas.height = modeConfig.height

  const nativeCtx = nativeCanvas.getContext('2d', { alpha: false })
  if (nativeCtx) {
    nativeCtx.fillStyle = '#000000'
    nativeCtx.fillRect(0, 0, nativeCanvas.width, nativeCanvas.height)
    nativeCtx.imageSmoothingEnabled = false

    // Redimensionner simplement le canvas source vers les dimensions natives
    nativeCtx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      nativeCanvas.width,
      nativeCanvas.height
    )
  }

  return nativeCanvas
}

/**
 * Create a canvas with corrected CPC aspect ratio
 * @param sourceCanvas Source canvas to resize
 * @param modeConfig CPC mode configuration
 * @returns Canvas with corrected aspect ratio
 */
export function createCorrectedAspectCanvas(
  sourceCanvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig
): HTMLCanvasElement {
  const { widthMultiplier, heightMultiplier } = getAspectRatioMultipliers(
    modeConfig.mode
  )

  // Toujours partir des dimensions natives et appliquer le ratio
  const correctedCanvas = document.createElement('canvas')
  const correctedWidth = modeConfig.width * widthMultiplier
  const correctedHeight = modeConfig.height * heightMultiplier

  correctedCanvas.width = correctedWidth
  correctedCanvas.height = correctedHeight

  const correctedCtx = correctedCanvas.getContext('2d', { alpha: false })
  if (correctedCtx) {
    // Fill with black background first
    correctedCtx.fillStyle = '#000000'
    correctedCtx.fillRect(0, 0, correctedWidth, correctedHeight)

    // Disable smoothing for pixel-perfect scaling
    correctedCtx.imageSmoothingEnabled = false

    // Redimensionner le canvas source vers les dimensions avec ratio
    correctedCtx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      correctedWidth,
      correctedHeight
    )
  }

  return correctedCanvas
}

/**
 * Convert canvas to PNG blob
 * @param canvas Canvas to convert
 * @returns Promise with PNG blob
 */
export async function canvasToPNGBlob(
  canvas: HTMLCanvasElement
): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png')
  })
}
