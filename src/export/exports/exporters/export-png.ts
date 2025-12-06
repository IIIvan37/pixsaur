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
 * Create a canvas from pixel data at native dimensions
 */
function createCanvasFromPixelData(
  pixelData: Uint8ClampedArray,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (ctx) {
    const imageData = new ImageData(pixelData, width, height)
    ctx.putImageData(imageData, 0, 0)
  }
  return canvas
}

/**
 * Scale a canvas to corrected aspect ratio
 */
function scaleToAspectRatio(
  sourceCanvas: HTMLCanvasElement,
  widthMultiplier: number,
  heightMultiplier: number
): HTMLCanvasElement {
  const correctedWidth = sourceCanvas.width * widthMultiplier
  const correctedHeight = sourceCanvas.height * heightMultiplier

  const correctedCanvas = document.createElement('canvas')
  correctedCanvas.width = correctedWidth
  correctedCanvas.height = correctedHeight

  const ctx = correctedCanvas.getContext('2d', { alpha: false })
  if (ctx) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, correctedWidth, correctedHeight)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
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

  // Create canvas from pixel data and scale to corrected aspect ratio
  const nativeCanvas = createCanvasFromPixelData(
    pixelData,
    modeConfig.width,
    modeConfig.height
  )
  const correctedCanvas = scaleToAspectRatio(
    nativeCanvas,
    widthMultiplier,
    heightMultiplier
  )

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

/**
 * Check if raster data is valid for export
 */
function hasValidRasterData(
  rasterData?: PNGExportData
): rasterData is PNGExportData {
  return Boolean(
    rasterData &&
      rasterData.rasterRanges.length > 0 &&
      rasterData.globalPalette.length > 0
  )
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
    if (hasValidRasterData(rasterData)) {
      await exportCorrectedAspectPNGWithRasters(
        zip,
        rasterData.indexBuf,
        modeConfig,
        rasterData.globalPalette,
        rasterData.rasterRanges
      )
    } else {
      await exportCorrectedAspectPNG(zip, canvas, modeConfig)
    }
  }
}
