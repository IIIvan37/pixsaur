/**
 * CPC Playground Export Module
 *
 * Exports ASM source code to CPC Playground for live testing.
 * Uses the CPC Playground share API to create a shareable link.
 */

import { createLogger } from '@/core'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import type { CPCHardware } from '@/libs/types'
import { isTauri } from '@/tauri'
import { firmwareToHardware } from '../cpc-format'
import { cpcPlusValuesToASM, paletteToCPCPlusValues } from '../cpc-plus-format'
import { exportEgxLinear, exportEgxSCR, isEgxOverscan } from '../export-scr'
import {
  assembleEgxSnaSource,
  generateEgxOverscanSnaTemplate,
  generateEgxPlusOverscanSnaTemplate,
  generateEgxPlusSnaTemplate,
  generateEgxSnaTemplate
} from '../templates'
import { toASMData } from '../to-asm-data'
import {
  generateModeRSnaAsmSource,
  generateSnaAsmSource,
  type ModeRSnaExportOptions,
  type SnaExportOptions
} from './export-sna'

const logger = createLogger({ prefix: '[CPC Playground Export]' })

const CPC_PLAYGROUND_URL = 'https://cpc-playground.iiivan.org'
const SHARE_API_URL = `${CPC_PLAYGROUND_URL}/api/share`

export interface CpcPlaygroundExportResult {
  success: boolean
  shareUrl?: string
  error?: string
}

/**
 * Options for EGX CPC Playground export
 */
export interface EgxCpcPlaygroundExportOptions {
  indexBuf: Uint8Array
  width: number
  height: number
  egxConfig: EGXConfig
  /** Firmware palette for Classic, RGB palette for Plus */
  paletteFirmware?: number[]
  /** RGB palette for Plus mode */
  paletteRgb?: Array<[number, number, number]>
  /** CPC hardware type */
  hardware?: CPCHardware
  filename?: string
}

/**
 * Share ASM source code to CPC Playground and open in browser
 * Common function used by all export types
 */
async function shareAsmToCpcPlayground(
  asmSource: string,
  exportType: string
): Promise<CpcPlaygroundExportResult> {
  logger.debug(`Generated ${exportType} ASM source`, {
    length: asmSource.length
  })

  // Send to CPC Playground share API
  const response = await fetch(SHARE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code: asmSource })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  const { id } = await response.json()

  if (!id) {
    throw new Error('No share ID returned')
  }

  const shareUrl = `${CPC_PLAYGROUND_URL}?share=${id}`

  logger.info(`${exportType} CPC Playground share created`, { shareUrl })

  // Open in browser (Tauri uses shell plugin, web uses window.open)
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(shareUrl)
    logger.debug('Opened URL via Tauri shell plugin')
  } else {
    window.open(shareUrl, '_blank')
    logger.debug('Opened URL via window.open')
  }

  return {
    success: true,
    shareUrl
  }
}

/**
 * Share ASM code to CPC Playground and open in new tab
 */
export async function exportToCpcPlayground(
  options: SnaExportOptions
): Promise<CpcPlaygroundExportResult> {
  logger.info('Starting CPC Playground export', {
    hardware: options.hardware,
    hasRasters: options.hasRasters
  })

  try {
    const asmSource = generateSnaAsmSource(options)

    if (!asmSource) {
      return {
        success: false,
        error: 'Failed to generate ASM source code'
      }
    }

    return await shareAsmToCpcPlayground(asmSource, 'Standard')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('CPC Playground export error', { error: errorMessage })
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Share Mode R ASM code to CPC Playground and open in new tab
 * Mode R uses two frames alternating at 50Hz with different palettes
 */
export async function exportModeRToCpcPlayground(
  options: ModeRSnaExportOptions
): Promise<CpcPlaygroundExportResult> {
  logger.info('Starting Mode R CPC Playground export', {
    hardware: options.hardware
  })

  try {
    const asmSource = generateModeRSnaAsmSource(options)

    if (!asmSource) {
      return {
        success: false,
        error: 'Failed to generate Mode R ASM source code'
      }
    }

    return await shareAsmToCpcPlayground(asmSource, 'Mode R')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Mode R CPC Playground export error', { error: errorMessage })
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Generate EGX ASM source code for CPC Classic
 */
function generateEgxClassicAsmSource(
  options: EgxCpcPlaygroundExportOptions
): string | null {
  const { indexBuf, width, height, egxConfig, paletteFirmware } = options

  if (!paletteFirmware) {
    return null
  }

  const overscan = isEgxOverscan(width, height, egxConfig.type)

  // Generate EGX Classic template (standard or overscan)
  const template = overscan
    ? generateEgxOverscanSnaTemplate({ egxConfig, height })
    : generateEgxSnaTemplate({ egxConfig, height })

  // Generate palette ASM (hardware values)
  const colorCount = egxConfig.type === 'egx1' ? 16 : 4
  const hardwarePalette = paletteFirmware
    .slice(0, colorCount)
    .map((fw) => firmwareToHardware[fw] ?? 0x54)

  const paletteBytes = hardwarePalette
    .map((hw) => `#${hw.toString(16).padStart(2, '0').toUpperCase()}`)
    .join(',')

  const paletteAsm = `Palette_Hardware:
    DB      ${paletteBytes}`

  // Generate image data ASM (SCR for standard, linear for overscan)
  if (overscan) {
    const linearData = exportEgxLinear(indexBuf, width, height, egxConfig)
    // Split into two chunks for overscan
    const halfSize = Math.floor(linearData.length / 2)
    const chunk1 = linearData.slice(0, halfSize)
    const chunk2 = linearData.slice(halfSize)

    const imageAsmResult1 = toASMData(chunk1, 'ImageData_chunk_0')
    const imageAsmResult2 = toASMData(chunk2, 'ImageData_chunk_1')

    const imageAsm =
      typeof imageAsmResult1 === 'string'
        ? imageAsmResult1
        : (imageAsmResult1[0]?.content ?? '')
    const imageAsm2 =
      typeof imageAsmResult2 === 'string'
        ? imageAsmResult2
        : (imageAsmResult2[0]?.content ?? '')

    return assembleEgxSnaSource(
      template,
      { paletteAsm, imageAsm, imageAsm2 },
      { overscan: true }
    )
  } else {
    const egxScrData = exportEgxSCR(indexBuf, width, height, egxConfig)
    const imageAsmResult = toASMData(egxScrData, 'ImageData')
    const imageAsm =
      typeof imageAsmResult === 'string'
        ? imageAsmResult
        : (imageAsmResult[0]?.content ?? '')

    return assembleEgxSnaSource(template, { paletteAsm, imageAsm })
  }
}

/**
 * Generate EGX ASM source code for CPC Plus
 */
function generateEgxPlusAsmSource(
  options: EgxCpcPlaygroundExportOptions
): string | null {
  const { indexBuf, width, height, egxConfig, paletteRgb } = options

  if (!paletteRgb) {
    return null
  }

  const overscan = isEgxOverscan(width, height, egxConfig.type)

  // Generate EGX Plus template (standard or overscan)
  const template = overscan
    ? generateEgxPlusOverscanSnaTemplate({
        egxConfig,
        height,
        hardware: 'plus'
      })
    : generateEgxPlusSnaTemplate({ egxConfig, height, hardware: 'plus' })

  // Generate palette ASM (12-bit CPC Plus values)
  const colorCount = egxConfig.type === 'egx1' ? 16 : 4
  const paletteSlice = paletteRgb.slice(0, colorCount)
  const cpcPlusValues = paletteToCPCPlusValues(paletteSlice)
  const paletteAsm = cpcPlusValuesToASM(cpcPlusValues, 'Palette_Plus')

  // Generate image data ASM (SCR for standard, linear for overscan)
  if (overscan) {
    const linearData = exportEgxLinear(indexBuf, width, height, egxConfig)
    // Split into two chunks for overscan
    const halfSize = Math.floor(linearData.length / 2)
    const chunk1 = linearData.slice(0, halfSize)
    const chunk2 = linearData.slice(halfSize)

    const imageAsmResult1 = toASMData(chunk1, 'ImageData_chunk_0')
    const imageAsmResult2 = toASMData(chunk2, 'ImageData_chunk_1')

    const imageAsm =
      typeof imageAsmResult1 === 'string'
        ? imageAsmResult1
        : (imageAsmResult1[0]?.content ?? '')
    const imageAsm2 =
      typeof imageAsmResult2 === 'string'
        ? imageAsmResult2
        : (imageAsmResult2[0]?.content ?? '')

    return assembleEgxSnaSource(
      template,
      { paletteAsm, imageAsm, imageAsm2 },
      { overscan: true }
    )
  } else {
    const egxScrData = exportEgxSCR(indexBuf, width, height, egxConfig)
    const imageAsmResult = toASMData(egxScrData, 'ImageData')
    const imageAsm =
      typeof imageAsmResult === 'string'
        ? imageAsmResult
        : (imageAsmResult[0]?.content ?? '')

    return assembleEgxSnaSource(template, { paletteAsm, imageAsm })
  }
}

/**
 * Generate EGX ASM source code (dispatches to Classic or Plus)
 */
export function generateEgxAsmSource(
  options: EgxCpcPlaygroundExportOptions
): string | null {
  const isPlus = options.hardware === 'plus'

  if (isPlus) {
    return generateEgxPlusAsmSource(options)
  } else {
    return generateEgxClassicAsmSource(options)
  }
}

/**
 * Share EGX ASM code to CPC Playground and open in new tab
 * EGX uses line-by-line mode switching for enhanced graphics
 */
export async function exportEgxToCpcPlayground(
  options: EgxCpcPlaygroundExportOptions
): Promise<CpcPlaygroundExportResult> {
  const { egxConfig, width, height, hardware } = options

  logger.info('Starting EGX CPC Playground export', {
    type: egxConfig.type,
    firstLineMode: egxConfig.firstLineMode,
    width,
    height,
    hardware: hardware ?? 'classic'
  })

  try {
    const asmSource = generateEgxAsmSource(options)

    if (!asmSource) {
      return {
        success: false,
        error: 'Failed to generate EGX ASM source code'
      }
    }

    return await shareAsmToCpcPlayground(asmSource, 'EGX')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('EGX CPC Playground export error', { error: errorMessage })
    return {
      success: false,
      error: errorMessage
    }
  }
}
