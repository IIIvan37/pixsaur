/**
 * CPC Playground Export Module
 *
 * Exports ASM source code to CPC Playground for live testing.
 * Uses the CPC Playground share API to create a shareable link.
 */

import { createLogger } from '@/core'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import type { CPCHardware } from '@/libs/types'
import { resolvePlaygroundPort } from '../../application/playground-port'
import { egxAsmSource } from '../egx-asm-source'
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

  // Open the share URL through the playground port (Tauri shell on desktop,
  // new tab on web). The platform-specific adapter is resolved at the edge.
  await resolvePlaygroundPort().open(shareUrl)
  logger.debug('Opened CPC Playground share URL')

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
    const asmSource = egxAsmSource(options)

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
