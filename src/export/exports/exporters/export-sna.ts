/**
 * SNA (Snapshot) Export Module
 *
 * Exports CPC images as executable SNA snapshot files using RASM WebAssembly.
 * Supports both CPC Classic and CPC Plus hardware, with or without raster effects,
 * in standard SCR or overscan format.
 */

import type { CpcModeConfig } from '@/app/store/config/types'
import { createLogger } from '@/core'
import { firmwareToHardware } from '../cpc-format'
import {
  exportLinearAsm,
  splitLinearIntoChunks
} from '../export-linear-asm/export-linear.asm'
import { exportSCR } from '../export-scr/export-scr'
import {
  assembleSnaSource,
  generateSnaTemplate,
  type SnaDataFiles,
  type SnaTemplateOptions
} from '../templates/sna-templates'
import { toASMData } from '../to-asm-data'

const logger = createLogger({ prefix: '[SNA Export]' })

// =============================================================================
// Types
// =============================================================================

export interface SnaExportOptions {
  /** Index buffer containing color indices for each pixel */
  indexBuf: Uint8Array
  /** CPC mode configuration */
  modeConfig: CpcModeConfig
  /** Hardware type ('classic' or 'plus') */
  hardware: 'classic' | 'plus'
  /** CPC firmware palette indices (for Classic) */
  paletteFirmware?: number[]
  /** CPC Plus palette values (12-bit 0GRB format) */
  palettePlus?: number[]
  /** Raster ASM data (if rasters are enabled) */
  rasterAsm?: string
  /** Whether raster effects are enabled */
  hasRasters: boolean
  /** Output filename (without extension) */
  filename?: string
}

export interface SnaExportResult {
  /** Whether the export was successful */
  success: boolean
  /** The generated SNA file data */
  snapshot?: Uint8Array
  /** The generated ASM source code (for debugging) */
  asmSource?: string
  /** Error message if export failed */
  error?: string
}

// =============================================================================
// Palette Generation
// =============================================================================

/**
 * Generate hardware palette ASM for CPC Classic
 */
function generateClassicPaletteAsm(paletteFirmware: number[]): string {
  const hardwarePalette = paletteFirmware
    .slice(0, 16)
    .map((fw) => firmwareToHardware[fw] ?? 0x54)

  const bytes = hardwarePalette
    .map((hw) => `#${hw.toString(16).padStart(2, '0').toUpperCase()}`)
    .join(',')

  return `Palette_Hardware:
    DB      ${bytes}`
}

/**
 * Generate palette ASM for CPC Plus (DEFW format)
 */
function generatePlusPaletteAsm(palettePlus: number[]): string {
  const values = palettePlus
    .slice(0, 16)
    .map((v) => `#${v.toString(16).padStart(4, '0').toUpperCase()}`)
    .join(', ')

  return `Palette:
    DEFW ${values}`
}

// =============================================================================
// Image Data Generation
// =============================================================================

/**
 * Generate SCR format image data ASM
 */
function generateScrImageAsm(
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

// =============================================================================
// Main Export Function
// =============================================================================

/**
 * Check if mode is standard (not overscan)
 */
function isStandardMode(modeConfig: CpcModeConfig): boolean {
  if (modeConfig.overscan) {
    return false
  }

  const standardDimensions = [
    { mode: 0, width: 160, height: 200 },
    { mode: 1, width: 320, height: 200 },
    { mode: 2, width: 640, height: 200 }
  ]

  return standardDimensions.some(
    (std) =>
      modeConfig.mode === std.mode &&
      modeConfig.width === std.width &&
      modeConfig.height === std.height
  )
}

/**
 * Export image as SNA snapshot
 */
export async function exportSna(
  options: SnaExportOptions
): Promise<SnaExportResult> {
  const {
    indexBuf,
    modeConfig,
    hardware,
    paletteFirmware,
    palettePlus,
    rasterAsm,
    hasRasters,
    filename = 'pixsaur'
  } = options

  logger.info('Starting SNA export', {
    hardware,
    mode: modeConfig.mode,
    width: modeConfig.width,
    height: modeConfig.height,
    overscan: modeConfig.overscan,
    hasRasters
  })

  try {
    // Determine if standard or overscan
    const isStandard = isStandardMode(modeConfig)
    const isOverscan = !isStandard

    // Generate template options
    const templateOptions: SnaTemplateOptions = {
      mode: modeConfig.mode,
      height: modeConfig.height,
      overscan: isOverscan,
      hasRasters,
      hardware
    }

    // Generate template
    const template = generateSnaTemplate(templateOptions)

    // Generate data files
    const dataFiles: SnaDataFiles = {
      paletteAsm: '',
      imageAsm: '',
      rasterAsm: hasRasters ? rasterAsm : undefined
    }

    // Generate palette ASM
    if (hardware === 'plus') {
      if (!palettePlus) {
        return {
          success: false,
          error: 'CPC Plus palette required for Plus hardware'
        }
      }
      dataFiles.paletteAsm = generatePlusPaletteAsm(palettePlus)
    } else {
      if (!paletteFirmware) {
        return {
          success: false,
          error: 'Firmware palette required for Classic hardware'
        }
      }
      dataFiles.paletteAsm = generateClassicPaletteAsm(paletteFirmware)
    }

    // Generate image data ASM
    if (isOverscan) {
      const linearResult = generateLinearImageAsm(
        indexBuf,
        modeConfig,
        'ImageData'
      )
      if (!linearResult) {
        return {
          success: false,
          error: 'Failed to generate linear image data'
        }
      }
      dataFiles.imageAsm = linearResult.chunk0
      dataFiles.imageAsm2 = linearResult.chunk1
    } else {
      const scrAsm = generateScrImageAsm(indexBuf, modeConfig, 'ImageData')
      if (!scrAsm) {
        return {
          success: false,
          error: 'Failed to generate SCR image data'
        }
      }
      dataFiles.imageAsm = scrAsm
    }

    // Assemble complete ASM source
    const asmSource = assembleSnaSource(template, dataFiles, templateOptions)

    logger.debug('Generated ASM source', { length: asmSource.length })

    // Assemble with RASM
    const { createRasmInstance } = await import('@/libs/rasm-wasm')
    const rasmInstance = await createRasmInstance()

    const snapshotFile = `${filename}.sna`
    const result = await rasmInstance.assemble(asmSource, {
      outputFile: `${filename}.bin`,
      exportType: 'snapshot',
      snapshotFile
    })

    if (!result.success) {
      logger.error('RASM assembly failed', { output: result.output })
      return {
        success: false,
        asmSource,
        error: `Assembly failed: ${result.output}`
      }
    }

    if (!result.snapshot) {
      return {
        success: false,
        asmSource,
        error: 'No snapshot generated'
      }
    }

    logger.info('SNA export successful', { size: result.snapshot.length })

    return {
      success: true,
      snapshot: result.snapshot,
      asmSource
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('SNA export error', { error: errorMessage })
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Generate only the ASM source without assembling
 * Useful for debugging or including in ZIP exports
 */
export function generateSnaAsmSource(options: SnaExportOptions): string | null {
  const {
    indexBuf,
    modeConfig,
    hardware,
    paletteFirmware,
    palettePlus,
    rasterAsm,
    hasRasters
  } = options

  try {
    const isStandard = isStandardMode(modeConfig)
    const isOverscan = !isStandard

    const templateOptions: SnaTemplateOptions = {
      mode: modeConfig.mode,
      height: modeConfig.height,
      overscan: isOverscan,
      hasRasters,
      hardware
    }

    const template = generateSnaTemplate(templateOptions)

    const dataFiles: SnaDataFiles = {
      paletteAsm: '',
      imageAsm: '',
      rasterAsm: hasRasters ? rasterAsm : undefined
    }

    // Generate palette ASM
    if (hardware === 'plus') {
      if (!palettePlus) return null
      dataFiles.paletteAsm = generatePlusPaletteAsm(palettePlus)
    } else {
      if (!paletteFirmware) return null
      dataFiles.paletteAsm = generateClassicPaletteAsm(paletteFirmware)
    }

    // Generate image data ASM
    if (isOverscan) {
      const linearResult = generateLinearImageAsm(
        indexBuf,
        modeConfig,
        'ImageData'
      )
      if (!linearResult) return null
      dataFiles.imageAsm = linearResult.chunk0
      dataFiles.imageAsm2 = linearResult.chunk1
    } else {
      const scrAsm = generateScrImageAsm(indexBuf, modeConfig, 'ImageData')
      if (!scrAsm) return null
      dataFiles.imageAsm = scrAsm
    }

    return assembleSnaSource(template, dataFiles, templateOptions)
  } catch {
    return null
  }
}
