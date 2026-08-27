/**
 * SNA (Snapshot) Export Module
 *
 * Exports CPC images as executable SNA snapshot files using RASM WebAssembly.
 * Supports both CPC Classic and CPC Plus hardware, with or without raster effects,
 * in standard SCR or overscan format.
 */

import { createLogger } from '@/core'
import type { CpcModeConfig } from '@/domain/cpc'
import type { CPCHardware } from '@/libs/types'
import { assembleSnapshot } from '../assemble-snapshot'
import { hardwarePaletteAsm, plusPaletteAsm } from '../palette-asm'
import {
  type SnaAsmSourceInput,
  scrImageAsm,
  snaAsmSource
} from '../sna-asm-source'
import {
  assembleModeRSnaSource,
  generateModeRClassicSnaTemplate,
  generateModeRPlusSnaTemplate,
  type ModeRDataFiles
} from '../templates/sna-templates'

const logger = createLogger({ prefix: '[SNA Export]' })

// =============================================================================
// Types
// =============================================================================

export interface SnaExportOptions extends SnaAsmSourceInput {
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
// Main Export Function
// =============================================================================

/**
 * Export image as SNA snapshot
 */
export async function exportSna(
  options: SnaExportOptions
): Promise<SnaExportResult> {
  const { modeConfig, hardware, hasRasters, filename = 'pixsaur' } = options

  logger.info('Starting SNA export', {
    hardware,
    mode: modeConfig.mode,
    width: modeConfig.width,
    height: modeConfig.height,
    overscan: modeConfig.overscan,
    hasRasters
  })

  try {
    const asm = snaAsmSource(options)

    if ('error' in asm) {
      return { success: false, error: asm.error }
    }

    const { source } = asm
    logger.debug('Generated ASM source', { length: source.length })

    const { snapshot, error } = await assembleSnapshot(source, filename)

    if (!snapshot) {
      logger.error('RASM assembly failed', { error })
      return { success: false, asmSource: source, error }
    }

    logger.info('SNA export successful', { size: snapshot.length })

    return { success: true, snapshot, asmSource: source }
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
 * Generate only the ASM source without assembling.
 * Useful for debugging or including in ZIP exports.
 */
export function generateSnaAsmSource(options: SnaExportOptions): string | null {
  try {
    const asm = snaAsmSource(options)

    return 'error' in asm ? null : asm.source
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
      dataFiles.paletteAAsm = plusPaletteAsm(paletteAPlus, {
        label: 'ModeR_PaletteA'
      })
      dataFiles.paletteBAsm = plusPaletteAsm(paletteBPlus, {
        label: 'ModeR_PaletteB'
      })
    } else {
      if (!paletteAFirmware || !paletteBFirmware) return null
      dataFiles.paletteAAsm = hardwarePaletteAsm(paletteAFirmware, {
        label: 'ModeR_PaletteA_Hardware'
      })
      dataFiles.paletteBAsm = hardwarePaletteAsm(paletteBFirmware, {
        label: 'ModeR_PaletteB_Hardware'
      })
    }

    // Generate SCR image data for both frames
    const frameAAsm = scrImageAsm(indexBufA, modeConfig, 'FrameA')
    if (!frameAAsm) return null
    dataFiles.frameAAsm = frameAAsm

    const frameBAsm = scrImageAsm(indexBufB, modeConfig, 'FrameB')
    if (!frameBAsm) return null
    dataFiles.frameBAsm = frameBAsm

    return assembleModeRSnaSource(template, dataFiles)
  } catch {
    return null
  }
}
