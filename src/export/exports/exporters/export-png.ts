import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import {
  canvasToPNGBlob,
  createCorrectedAspectCanvas,
  createSquarePixelsCanvas
} from '../export-png-utils'
import type { ExportConfig } from '../types'

/**
 * Export PNG with native CPC dimensions (1:1 square pixels)
 */
async function exportSquarePixelsPNG(
  zip: JSZip,
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig
) {
  const nativeCanvas = createSquarePixelsCanvas(canvas, modeConfig)
  const blob = await canvasToPNGBlob(nativeCanvas)
  zip.file('pixsaur.png', blob)
}

/**
 * Export PNG with corrected CPC aspect ratio
 */
async function exportCorrectedAspectPNG(
  zip: JSZip,
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig
) {
  const correctedCanvas = createCorrectedAspectCanvas(canvas, modeConfig)
  const correctedBlob = await canvasToPNGBlob(correctedCanvas)
  zip.file('pixsaur_corrected_aspect.png', correctedBlob)
}

export async function exportPNGData(
  zip: JSZip,
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig,
  config: ExportConfig
) {
  // Export original PNG (square pixels - 1:1 ratio)
  if (config.content.includePNG) {
    await exportSquarePixelsPNG(zip, canvas, modeConfig)
  }

  // Export PNG with correct aspect ratio
  if (config.content.includePNGCorrected) {
    await exportCorrectedAspectPNG(zip, canvas, modeConfig)
  }
}
