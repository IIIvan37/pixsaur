/**
 * Helper functions for export data preparation
 *
 * Extracted from export-panel.tsx to reduce cognitive complexity
 * and improve testability.
 */

import { IGNORED_SLOT } from '@/app/store/preview/preview'
import {
  rgbToCPCPlus,
  rgbToFirmwareIndex,
  rgbToIndexBufferExact
} from '@/export'

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

/** Generate index buffer from image data */
export function generateIndexBuffer(
  imageData: Uint8ClampedArray,
  palette: unknown[],
  isCPCPlus: boolean
): Uint8Array {
  return rgbToIndexBufferExact(
    imageData,
    palette as ([number, number, number] | Float32Array)[],
    false,
    isCPCPlus
  )
}

/** Export data result type */
export interface ExportDataResult {
  indexBuf: Uint8Array
  paletteFirmware: number[]
  palettePlus: number[]
  effectivePalette: unknown[]
  cleanImage: ImageData
}

/** Parameters for getExportData */
export interface GetExportDataParams {
  image: ImageData | null | undefined
  exportPalette: unknown[]
  rasterEnabled: boolean
  rasterBasePalette: unknown[] | null
  rasterIndexBuffer: { buffer: Uint8Array } | null
  cpcHardware: 'classic' | 'plus'
}

/** Prepare export data based on hardware type and raster settings */
export function prepareExportData(
  params: GetExportDataParams
): ExportDataResult | null {
  const {
    image,
    exportPalette,
    rasterEnabled,
    rasterBasePalette,
    rasterIndexBuffer,
    cpcHardware
  } = params

  if (!image?.data) return null

  const cleanImage = image
  const useRasterPalette = rasterEnabled && rasterBasePalette
  const effectivePalette = useRasterPalette ? rasterBasePalette : exportPalette

  let indexBuf: Uint8Array
  let paletteFirmware: number[] = []
  let palettePlus: number[] = []

  if (cpcHardware === 'classic') {
    paletteFirmware = convertPaletteToFirmware(
      effectivePalette as unknown[],
      !!useRasterPalette
    )
    indexBuf =
      useRasterPalette && rasterIndexBuffer
        ? rasterIndexBuffer.buffer
        : generateIndexBuffer(
            cleanImage.data,
            effectivePalette as unknown[],
            false
          )
  } else {
    // CPC Plus
    palettePlus = convertPaletteToCPCPlus(effectivePalette as unknown[])
    indexBuf =
      useRasterPalette && rasterIndexBuffer
        ? rasterIndexBuffer.buffer
        : generateIndexBuffer(
            cleanImage.data,
            effectivePalette as unknown[],
            true
          )
  }

  return {
    indexBuf,
    paletteFirmware,
    palettePlus,
    effectivePalette: effectivePalette as unknown[],
    cleanImage
  }
}
