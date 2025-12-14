import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import {
  canvasToPNGBlob,
  createCorrectedAspectCanvas,
  createSquarePixelsCanvas
} from '../export-png-utils'
import type { ExportConfig } from '../types'

/**
 * Create a canvas from ImageData
 */
function createCanvasFromImageData(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (ctx) {
    ctx.putImageData(imageData, 0, 0)
  }
  return canvas
}

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
 * Export PNG with corrected CPC aspect ratio from previewImage (with rasters already applied)
 * This is the same logic as the double-click on preview canvas
 */
async function exportCorrectedAspectPNGFromPreview(
  zip: JSZip,
  previewImage: ImageData,
  modeConfig: CpcModeConfig
) {
  // Create a canvas from the previewImage (which already has rasters applied)
  const sourceCanvas = createCanvasFromImageData(previewImage)

  // Apply corrected aspect ratio (same as double-click on preview)
  const correctedCanvas = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

  const correctedBlob = await canvasToPNGBlob(correctedCanvas)
  zip.file('pixsaur_corrected_aspect.png', correctedBlob)
}

/**
 * Export PNG with corrected CPC aspect ratio (no rasters - from source canvas)
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

/**
 * PNG export data - previewImage is the ImageData with rasters already applied
 * (same as what's displayed when double-clicking on preview canvas)
 */
export interface PNGExportData {
  /** Preview image with rasters already applied (from effectivePreviewImageAtom) */
  previewImage: ImageData
}

/**
 * Check if raster preview data is valid for export
 */
function hasValidPreviewData(
  rasterData?: PNGExportData
): rasterData is PNGExportData {
  return Boolean(rasterData?.previewImage)
}

export async function exportPNGData(
  zip: JSZip,
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  rasterData?: PNGExportData
) {
  if (config.content.includePNG) {
    await exportSquarePixelsPNG(zip, canvas, modeConfig)
  }

  if (config.content.includePNGCorrected) {
    if (hasValidPreviewData(rasterData)) {
      // Use previewImage directly (has rasters already applied)
      // This is the same rendering as double-click on preview
      await exportCorrectedAspectPNGFromPreview(
        zip,
        rasterData.previewImage,
        modeConfig
      )
    } else {
      // No raster data - use source canvas
      await exportCorrectedAspectPNG(zip, canvas, modeConfig)
    }
  }
}
