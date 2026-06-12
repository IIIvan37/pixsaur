/**
 * Use-case: export the current image to a CPC-native ZIP bundle.
 *
 * Pure orchestration extracted from `handleExport` in
 * `components/export-panel/export-panel.tsx`. The UI assembles the input from
 * atoms, injects the real ports, and maps the {@link ExportImageToZipResult} to
 * a notification. All side-effects (canvas creation, file persistence) arrive
 * through {@link CanvasFactory} / {@link FileSink}.
 */

import type { CpcModeConfig } from '@/domain/cpc'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCHardware } from '@/libs/types'
import { buildExportZipBlob } from '../exports/export-zip'
import { rgbToFirmwareIndex } from '../exports/raster-format'
import type { ExportConfig } from '../exports/types'
import type { CanvasFactory, FileSink } from './ports'

type RgbTriplet = [number, number, number]

/** EGX export branch: index buffer + RGB palette already resolved by the UI. */
export interface EgxExportSnapshot {
  indexBuffer: Uint8Array
  palette: ReadonlyArray<ArrayLike<number>>
  width: number
  height: number
  config: EGXConfig
}

/** Standard (non-EGX) export branch, as produced by `prepareExportData`. */
export interface StandardExportSnapshot {
  indexBuf: Uint8Array
  paletteFirmware: number[]
  effectivePalette: ReadonlyArray<unknown>
  cleanImage: ImageData
  rasterChanges?: RasterChange[]
  previewImage?: ImageData
}

export interface ExportImageToZipInput {
  modeConfig: CpcModeConfig
  cpcHardware: CPCHardware
  config: ExportConfig
  /** EGX snapshot when EGX mode is enabled, else `null`. */
  egx: EgxExportSnapshot | null
  /** Standard snapshot when EGX is off and export data is available, else `null`. */
  standard: StandardExportSnapshot | null
}

export interface ExportImageToZipDeps {
  canvasFactory: CanvasFactory
  fileSink: FileSink
}

export type ExportImageToZipResult = { ok: true } | { ok: false; error: string }

/** Normalize a palette entry (array or typed array) to an `[r, g, b]` tuple. */
function toRgbTriplet(colorData: unknown): RgbTriplet {
  const color = Array.isArray(colorData)
    ? colorData
    : Array.from(colorData as ArrayLike<number>)
  return [color[0], color[1], color[2]]
}

function toRgbTriplets(palette: ReadonlyArray<unknown>): RgbTriplet[] {
  return palette.map(toRgbTriplet)
}

/** Draw an `ImageData` onto a fresh canvas obtained from the factory. */
function drawImageDataToCanvas(
  canvasFactory: CanvasFactory,
  image: ImageData
): HTMLCanvasElement {
  const canvas = canvasFactory.createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx?.putImageData(image, 0, 0)
  return canvas
}

/** Build an `ImageData` from an index buffer + RGB palette. */
function indexBufferToImageData(
  buffer: Uint8Array,
  width: number,
  height: number,
  palette: ReadonlyArray<ArrayLike<number>>
): ImageData {
  const image = new ImageData(width, height)
  const pixels = image.data
  for (let i = 0; i < buffer.length; i++) {
    const color = palette[buffer[i]] ?? [0, 0, 0]
    const p = i * 4
    pixels[p] = color[0]
    pixels[p + 1] = color[1]
    pixels[p + 2] = color[2]
    pixels[p + 3] = 255
  }
  return image
}

export async function exportImageToZip(
  input: ExportImageToZipInput,
  deps: ExportImageToZipDeps
): Promise<ExportImageToZipResult> {
  const { modeConfig, cpcHardware, config, egx, standard } = input
  const { canvasFactory, fileSink } = deps

  let blob: Blob | null

  if (egx) {
    const { indexBuffer, palette, width, height, config: egxConfig } = egx
    const paletteFirmware = palette.map((c) =>
      rgbToFirmwareIndex(c[0], c[1], c[2])
    )
    const canvas = drawImageDataToCanvas(
      canvasFactory,
      indexBufferToImageData(indexBuffer, width, height, palette)
    )

    blob = await buildExportZipBlob({
      indexBuf: indexBuffer,
      paletteFirmware,
      canvas,
      modeConfig,
      cpcHardware,
      reducedPalette: toRgbTriplets(palette),
      config,
      egxConfig,
      egxWidth: width,
      egxHeight: height
    })
  } else if (standard) {
    const {
      indexBuf,
      paletteFirmware,
      effectivePalette,
      cleanImage,
      rasterChanges,
      previewImage
    } = standard
    const canvas = drawImageDataToCanvas(canvasFactory, cleanImage)

    blob = await buildExportZipBlob({
      indexBuf,
      paletteFirmware,
      canvas,
      modeConfig,
      cpcHardware,
      reducedPalette: toRgbTriplets(effectivePalette),
      config,
      rasterChanges,
      previewImage
    })
  } else {
    return { ok: false, error: 'no-export-data' }
  }

  if (!blob) return { ok: false, error: 'zip-generation-failed' }

  const filename = `${config.filename || 'pixsaur-export'}.zip`
  const ok = await fileSink.save(blob, filename)
  return ok ? { ok: true } : { ok: false, error: 'save-cancelled' }
}
