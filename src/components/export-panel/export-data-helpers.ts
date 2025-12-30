/**
 * Helper functions for export data preparation
 *
 * Extracted from export-panel.tsx to reduce cognitive complexity
 * and improve testability.
 */

import { IGNORED_SLOT, type IndexBufferData } from '@/app/store/preview/preview'
import { rgbToCPCPlus, rgbToFirmwareIndex } from '@/export'
import type { CPCHardware } from '@/libs/types'

/** Check if a color slot should be ignored (empty locked slot) */
export function isIgnoredSlot(color: number[]): boolean {
  return (
    color[0] === IGNORED_SLOT[0] &&
    color[1] === IGNORED_SLOT[1] &&
    color[2] === IGNORED_SLOT[2]
  )
}

/** Normalize color data to array format */
function normalizeColor(colorData: unknown): number[] {
  return Array.isArray(colorData)
    ? colorData
    : Array.from(colorData as Iterable<number>)
}

/** Convert palette to firmware indices for CPC Classic */
export function convertPaletteToFirmware(
  palette: unknown[],
  useRasterPalette: boolean
): number[] {
  return palette.map((colorData) => {
    const color = normalizeColor(colorData)
    if (!useRasterPalette && isIgnoredSlot(color)) return 0
    return rgbToFirmwareIndex(color[0], color[1], color[2])
  })
}

/** Convert palette to 12-bit 0GRB format for CPC Plus */
export function convertPaletteToCPCPlus(palette: unknown[]): number[] {
  return palette.map((colorData) => {
    const color = normalizeColor(colorData)
    if (isIgnoredSlot(color)) return 0
    return rgbToCPCPlus(color[0], color[1], color[2])
  })
}

/** Export data result type */
export interface ExportDataResult {
  indexBuf: Uint8Array
  paletteFirmware: number[]
  palettePlus: number[]
  effectivePalette: unknown[]
  cleanImage: ImageData
}

/** Parameters for prepareExportData */
export interface GetExportDataParams {
  /** Final index buffer with manual edits applied (non-raster mode) */
  finalPreviewIndexBuffer: IndexBufferData | null | undefined
  exportPalette: unknown[]
  rasterEnabled: boolean
  rasterBasePalette: unknown[] | null
  /** Final raster index buffer with manual edits applied */
  finalRasterIndexBuffer: IndexBufferData | null
  cpcHardware: CPCHardware
}

/**
 * Convert IndexBufferData to ImageData for export
 */
function indexBufferToImageData(data: IndexBufferData): ImageData {
  const { buffer, width, height, palette } = data
  const imageData = new ImageData(width, height)
  const pixels = imageData.data

  for (let i = 0; i < buffer.length; i++) {
    const inkIndex = buffer[i]
    const color = palette[inkIndex] ?? [0, 0, 0]
    const pixelIndex = i * 4
    pixels[pixelIndex] = color[0] // R
    pixels[pixelIndex + 1] = color[1] // G
    pixels[pixelIndex + 2] = color[2] // B
    pixels[pixelIndex + 3] = 255 // A
  }

  return imageData
}

/** Prepare export data based on hardware type and raster settings */
export function prepareExportData(
  params: GetExportDataParams
): ExportDataResult | null {
  const {
    finalPreviewIndexBuffer,
    exportPalette,
    rasterEnabled,
    rasterBasePalette,
    finalRasterIndexBuffer,
    cpcHardware
  } = params

  // Use raster buffer when raster is enabled and available, otherwise use preview buffer
  const useRaster = rasterEnabled && finalRasterIndexBuffer
  const indexBufferData = useRaster
    ? finalRasterIndexBuffer
    : finalPreviewIndexBuffer

  if (!indexBufferData) return null

  // Use the palette from the index buffer data (includes manual edit considerations)
  // or fall back to the appropriate palette based on mode
  const useRasterPalette = rasterEnabled && rasterBasePalette
  const effectivePalette = useRasterPalette ? rasterBasePalette : exportPalette

  const indexBuf = indexBufferData.buffer
  let paletteFirmware: number[] = []
  let palettePlus: number[] = []

  if (cpcHardware === 'classic') {
    paletteFirmware = convertPaletteToFirmware(
      effectivePalette,
      !!useRasterPalette
    )
  } else {
    // CPC Plus
    palettePlus = convertPaletteToCPCPlus(effectivePalette)
  }

  // Generate ImageData from index buffer for export
  const cleanImage = indexBufferToImageData(indexBufferData)

  return {
    indexBuf,
    paletteFirmware,
    palettePlus,
    effectivePalette,
    cleanImage
  }
}
