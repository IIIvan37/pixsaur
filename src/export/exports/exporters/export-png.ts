import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { getAspectRatioMultipliers } from '@/export'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { renderPreviewWithRaster } from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterRange } from '@/libs/pixsaur-raster/types'
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
 * Export PNG with corrected CPC aspect ratio and rasters applied
 */
async function exportCorrectedAspectPNGWithRasters(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  globalPalette: Vector[],
  rasterRanges: RasterRange[]
) {
  const { widthMultiplier, heightMultiplier } = getAspectRatioMultipliers(
    modeConfig.mode
  )

  // Apply rasters to the image (same as preview)
  const pixelData = renderPreviewWithRaster(
    indexBuf,
    modeConfig.width,
    modeConfig.height,
    globalPalette,
    rasterRanges
  )

  // Create a canvas with the raster-applied image at native size
  const nativeCanvas = document.createElement('canvas')
  nativeCanvas.width = modeConfig.width
  nativeCanvas.height = modeConfig.height
  const nativeCtx = nativeCanvas.getContext('2d', { alpha: false })
  if (nativeCtx) {
    const imageData = new ImageData(
      pixelData,
      modeConfig.width,
      modeConfig.height
    )
    nativeCtx.putImageData(imageData, 0, 0)
  }

  // Scale to corrected aspect ratio
  const correctedWidth = modeConfig.width * widthMultiplier
  const correctedHeight = modeConfig.height * heightMultiplier

  const correctedCanvas = document.createElement('canvas')
  correctedCanvas.width = correctedWidth
  correctedCanvas.height = correctedHeight

  const correctedCtx = correctedCanvas.getContext('2d', { alpha: false })
  if (correctedCtx) {
    correctedCtx.fillStyle = '#000000'
    correctedCtx.fillRect(0, 0, correctedWidth, correctedHeight)
    correctedCtx.imageSmoothingEnabled = false
    correctedCtx.drawImage(
      nativeCanvas,
      0,
      0,
      modeConfig.width,
      modeConfig.height,
      0,
      0,
      correctedWidth,
      correctedHeight
    )
  }

  const correctedBlob = await canvasToPNGBlob(correctedCanvas)
  zip.file('pixsaur_corrected_aspect.png', correctedBlob)
}

/**
 * Export PNG with corrected CPC aspect ratio (no rasters)
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

export interface PNGExportData {
  indexBuf: Uint8Array
  globalPalette: Vector[]
  rasterRanges: RasterRange[]
}

export async function exportPNGData(
  zip: JSZip,
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  rasterData?: PNGExportData
) {
  // Export original PNG (square pixels - 1:1 ratio)
  if (config.content.includePNG) {
    await exportSquarePixelsPNG(zip, canvas, modeConfig)
  }

  // Export PNG with correct aspect ratio
  if (config.content.includePNGCorrected) {
    // If raster data is available and there are rasters, apply them
    if (
      rasterData &&
      rasterData.rasterRanges.length > 0 &&
      rasterData.globalPalette.length > 0
    ) {
      await exportCorrectedAspectPNGWithRasters(
        zip,
        rasterData.indexBuf,
        modeConfig,
        rasterData.globalPalette,
        rasterData.rasterRanges
      )
    } else {
      // No rasters, use the canvas directly
      await exportCorrectedAspectPNG(zip, canvas, modeConfig)
    }
  }
}
