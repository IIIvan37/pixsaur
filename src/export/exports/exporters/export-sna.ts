/**
 * SNA (Snapshot) Export Module
 *
 * Exports CPC images as executable SNA snapshot files using RASM WebAssembly.
 * Supports both CPC Classic and CPC Plus hardware, with or without raster effects,
 * in standard SCR or overscan format.
 */

import type { CpcModeConfig } from '@/app/store/config/types'
import { createLogger } from '@/core'
import type { CPCHardware } from '@/libs/types'
import { firmwareToHardware } from '../cpc-format'
import {
  exportLinearAsm,
  splitLinearIntoChunks
} from '../export-linear-asm/export-linear.asm'
import { exportSCR } from '../export-scr/export-scr'
import {
  assembleModeRSnaSource,
  assembleSnaSource,
  generateModeRClassicSnaTemplate,
  generateModeRPlusSnaTemplate,
  generateSnaTemplate,
  type ModeRDataFiles,
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

// =============================================================================
// Mode R Export Functions
// =============================================================================

export interface ModeRSnaExportOptions {
  /** Index buffer for Frame A */
  indexBufA: Uint8Array
  /** Index buffer for Frame B */
  indexBufB: Uint8Array
  /** CPC mode configuration */
  modeConfig: CpcModeConfig
  /** Hardware type */
  hardware: CPCHardware
  /** CPC firmware palette indices for Frame A (for Classic) */
  paletteAFirmware?: number[]
  /** CPC firmware palette indices for Frame B (for Classic) */
  paletteBFirmware?: number[]
  /** CPC Plus palette values for Frame A (12-bit 0GRB format) */
  paletteAPlus?: number[]
  /** CPC Plus palette values for Frame B (12-bit 0GRB format) */
  paletteBPlus?: number[]
  /** Output filename (without extension) */
  filename?: string
}

/**
 * Generate hardware palette ASM for Mode R CPC Classic
 */
function generateModeRClassicPaletteAsm(
  palette: number[],
  label: string
): string {
  const hardwarePalette = palette
    .slice(0, 16)
    .map((fw) => firmwareToHardware[fw] ?? 0x54)

  const bytes = hardwarePalette
    .map((hw) => `#${hw.toString(16).padStart(2, '0').toUpperCase()}`)
    .join(',')

  return `${label}:
    DB      ${bytes}`
}

/**
 * Generate palette ASM for Mode R CPC Plus (DEFW format)
 */
function generateModeRPlusPaletteAsm(palette: number[], label: string): string {
  const values = palette
    .slice(0, 16)
    .map((v) => `#${v.toString(16).padStart(4, '0').toUpperCase()}`)
    .join(', ')

  return `${label}:
    DEFW ${values}`
}

/**
 * Export Mode R image as SNA snapshot
 * Generates two SCR frames that alternate at 50Hz with different palettes
 */
export async function exportModeRSna(
  options: ModeRSnaExportOptions
): Promise<SnaExportResult> {
  const {
    indexBufA,
    indexBufB,
    modeConfig,
    hardware,
    paletteAFirmware,
    paletteBFirmware,
    paletteAPlus,
    paletteBPlus,
    filename = 'pixsaur_modeR'
  } = options

  const isPlus = hardware === 'plus'

  logger.info('Starting Mode R SNA export', {
    hardware,
    mode: modeConfig.mode,
    width: modeConfig.width,
    height: modeConfig.height
  })

  try {
    // Generate template
    const template = isPlus
      ? generateModeRPlusSnaTemplate()
      : generateModeRClassicSnaTemplate()

    // Generate data files
    const dataFiles: ModeRDataFiles = {
      paletteAAsm: '',
      paletteBAsm: '',
      frameAAsm: '',
      frameBAsm: ''
    }

    // Generate palette ASM
    if (isPlus) {
      if (!paletteAPlus || !paletteBPlus) {
        return {
          success: false,
          error: 'CPC Plus palettes required for Plus hardware'
        }
      }
      dataFiles.paletteAAsm = generateModeRPlusPaletteAsm(
        paletteAPlus,
        'ModeR_PaletteA'
      )
      dataFiles.paletteBAsm = generateModeRPlusPaletteAsm(
        paletteBPlus,
        'ModeR_PaletteB'
      )
    } else {
      if (!paletteAFirmware || !paletteBFirmware) {
        return {
          success: false,
          error: 'Firmware palettes required for Classic hardware'
        }
      }
      dataFiles.paletteAAsm = generateModeRClassicPaletteAsm(
        paletteAFirmware,
        'ModeR_PaletteA_Hardware'
      )
      dataFiles.paletteBAsm = generateModeRClassicPaletteAsm(
        paletteBFirmware,
        'ModeR_PaletteB_Hardware'
      )
    }

    // Generate SCR image data for both frames
    const frameAAsm = generateScrImageAsm(indexBufA, modeConfig, 'FrameA')
    if (!frameAAsm) {
      return {
        success: false,
        error: 'Failed to generate Frame A image data'
      }
    }
    dataFiles.frameAAsm = frameAAsm

    const frameBAsm = generateScrImageAsm(indexBufB, modeConfig, 'FrameB')
    if (!frameBAsm) {
      return {
        success: false,
        error: 'Failed to generate Frame B image data'
      }
    }
    dataFiles.frameBAsm = frameBAsm

    // Assemble complete ASM source
    const asmSource = assembleModeRSnaSource(template, dataFiles)

    logger.debug('Generated Mode R ASM source', { length: asmSource.length })

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

    logger.info('Mode R SNA export successful', {
      size: result.snapshot.length
    })

    return {
      success: true,
      snapshot: result.snapshot,
      asmSource
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Mode R SNA export error', { error: errorMessage })
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Generate only the ASM source for Mode R without assembling
 * Useful for debugging or including in ZIP exports
 */
export function generateModeRSnaAsmSource(
  options: ModeRSnaExportOptions
): string | null {
  const {
    indexBufA,
    indexBufB,
    modeConfig,
    hardware,
    paletteAFirmware,
    paletteBFirmware,
    paletteAPlus,
    paletteBPlus
  } = options

  const isPlus = hardware === 'plus'

  try {
    const template = isPlus
      ? generateModeRPlusSnaTemplate()
      : generateModeRClassicSnaTemplate()

    const dataFiles: ModeRDataFiles = {
      paletteAAsm: '',
      paletteBAsm: '',
      frameAAsm: '',
      frameBAsm: ''
    }

    // Generate palette ASM
    if (isPlus) {
      if (!paletteAPlus || !paletteBPlus) return null
      dataFiles.paletteAAsm = generateModeRPlusPaletteAsm(
        paletteAPlus,
        'ModeR_PaletteA'
      )
      dataFiles.paletteBAsm = generateModeRPlusPaletteAsm(
        paletteBPlus,
        'ModeR_PaletteB'
      )
    } else {
      if (!paletteAFirmware || !paletteBFirmware) return null
      dataFiles.paletteAAsm = generateModeRClassicPaletteAsm(
        paletteAFirmware,
        'ModeR_PaletteA_Hardware'
      )
      dataFiles.paletteBAsm = generateModeRClassicPaletteAsm(
        paletteBFirmware,
        'ModeR_PaletteB_Hardware'
      )
    }

    // Generate SCR image data for both frames
    const frameAAsm = generateScrImageAsm(indexBufA, modeConfig, 'FrameA')
    if (!frameAAsm) return null
    dataFiles.frameAAsm = frameAAsm

    const frameBAsm = generateScrImageAsm(indexBufB, modeConfig, 'FrameB')
    if (!frameBAsm) return null
    dataFiles.frameBAsm = frameBAsm

    return assembleModeRSnaSource(template, dataFiles)
  } catch {
    return null
  }
}
