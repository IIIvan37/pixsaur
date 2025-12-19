/**
 * CPC Playground Export Module
 *
 * Exports ASM source code to CPC Playground for live testing.
 * Uses the CPC Playground share API to create a shareable link.
 */

import { createLogger } from '@/core'
import { generateSnaAsmSource, type SnaExportOptions } from './export-sna'

const logger = createLogger({ prefix: '[CPC Playground Export]' })

const CPC_PLAYGROUND_URL = 'https://cpc-playground.iiivan.org'
const SHARE_API_URL = `${CPC_PLAYGROUND_URL}/api/share`

export interface CpcPlaygroundExportResult {
  success: boolean
  shareUrl?: string
  error?: string
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
    // Generate ASM source
    const asmSource = generateSnaAsmSource(options)

    if (!asmSource) {
      return {
        success: false,
        error: 'Failed to generate ASM source code'
      }
    }

    logger.debug('Generated ASM source', { length: asmSource.length })

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

    logger.info('CPC Playground share created', { shareUrl })

    // Open in new tab
    window.open(shareUrl, '_blank')

    return {
      success: true,
      shareUrl
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('CPC Playground export error', { error: errorMessage })
    return {
      success: false,
      error: errorMessage
    }
  }
}
