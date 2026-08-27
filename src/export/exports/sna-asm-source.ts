/**
 * SNA ASM source production — the pure half of the SNA export.
 *
 * Turning an index buffer into an assemblable Z80 source needs no RASM, no
 * WASM and no I/O, so it lives apart from the exporter that assembles it:
 * `exportSna` and `generateSnaAsmSource` are the same procedure and only
 * differ in what they do with the result.
 */

import { createLogger } from '@/core'
import { type CpcModeConfig, isStandardScreen } from '@/domain/cpc'
import type { CPCHardware } from '@/libs/types'
import {
  exportLinearAsm,
  splitLinearIntoChunks
} from './export-linear-asm/export-linear.asm'
import { exportSCR } from './export-scr/export-scr'
import { hardwarePaletteAsm, plusPaletteAsm } from './palette-asm'
import {
  assembleSnaSource,
  generateSnaTemplate,
  type SnaDataFiles,
  type SnaTemplateOptions
} from './templates/sna-templates'
import { toASMData } from './to-asm-data'

const logger = createLogger({ prefix: '[SNA ASM]' })

export interface SnaAsmSourceInput {
  /** Index buffer containing color indices for each pixel */
  indexBuf: Uint8Array
  /** CPC mode configuration */
  modeConfig: CpcModeConfig
  /** Hardware type */
  hardware: CPCHardware
  /** CPC firmware palette indices (for Classic) */
  paletteFirmware?: number[]
  /** CPC Plus palette values (12-bit 0GRB format) */
  palettePlus?: number[]
  /** Raster ASM data (if rasters are enabled) */
  rasterAsm?: string
  /** Whether raster effects are enabled */
  hasRasters: boolean
}

/** Either the assembled source, or why it could not be produced. */
export type SnaAsmSourceResult = { source: string } | { error: string }

/**
 * Generate SCR format image data ASM.
 * Shared with the Mode R source, which emits one per frame.
 */
export function scrImageAsm(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  label: string
): string | null {
  const scrData = exportSCR(indexBuf, modeConfig)
  const asmResult = toASMData(scrData, label)

  if (typeof asmResult === 'string') {
    return asmResult
  }

  // SCR should fit in one chunk for standard mode
  logger.warn('SCR data unexpectedly chunked')
  return asmResult[0]?.content ?? null
}

/**
 * Generate linear format image data ASM (for overscan)
 */
function generateLinearImageAsm(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  label: string
): { chunk0: string; chunk1?: string } | null {
  const linearData = exportLinearAsm(indexBuf, modeConfig)
  const chunks = splitLinearIntoChunks(linearData)

  if (chunks.length === 0) {
    return null
  }

  const results: { chunk0: string; chunk1?: string } = { chunk0: '' }

  for (const chunk of chunks) {
    const asmResult = toASMData(
      chunk.data,
      `${label}_linear_chunk_${chunk.index - 1}`
    )
    if (typeof asmResult === 'string') {
      if (chunk.index === 1) {
        results.chunk0 = asmResult
      } else if (chunk.index === 2) {
        results.chunk1 = asmResult
      }
    }
  }

  return results
}

/**
 * Build the complete SNA ASM source for one image.
 */
export function snaAsmSource(input: SnaAsmSourceInput): SnaAsmSourceResult {
  const {
    indexBuf,
    modeConfig,
    hardware,
    paletteFirmware,
    palettePlus,
    rasterAsm,
    hasRasters
  } = input

  const templateOptions: SnaTemplateOptions = {
    mode: modeConfig.mode,
    height: modeConfig.height,
    overscan: !isStandardScreen(modeConfig),
    hasRasters,
    hardware
  }

  const dataFiles: SnaDataFiles = {
    paletteAsm: '',
    imageAsm: '',
    rasterAsm: hasRasters ? rasterAsm : undefined
  }

  if (hardware === 'plus') {
    if (!palettePlus) {
      return { error: 'CPC Plus palette required for Plus hardware' }
    }
    dataFiles.paletteAsm = plusPaletteAsm(palettePlus, { label: 'Palette' })
  } else {
    if (!paletteFirmware) {
      return { error: 'Firmware palette required for Classic hardware' }
    }
    dataFiles.paletteAsm = hardwarePaletteAsm(paletteFirmware, {
      label: 'Palette_Hardware'
    })
  }

  if (templateOptions.overscan) {
    const linearResult = generateLinearImageAsm(
      indexBuf,
      modeConfig,
      'ImageData'
    )
    if (!linearResult) {
      return { error: 'Failed to generate linear image data' }
    }
    dataFiles.imageAsm = linearResult.chunk0
    dataFiles.imageAsm2 = linearResult.chunk1
  } else {
    const scrAsm = scrImageAsm(indexBuf, modeConfig, 'ImageData')
    if (!scrAsm) {
      return { error: 'Failed to generate SCR image data' }
    }
    dataFiles.imageAsm = scrAsm
  }

  return {
    source: assembleSnaSource(
      generateSnaTemplate(templateOptions),
      dataFiles,
      templateOptions
    )
  }
}
