import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { injectPaletteDataIntoSCR } from '@/palettes/cpc-palette'
import { injectCPCPlusPaletteIntoSCR } from '../cpc-plus-format'
import { exportSCR } from '../export-scr/export-scr'
import { toASMData } from '../to-asm-data'
import type { ExportConfig } from '../types'
import { getHeader } from './utils'

/**
 * Generate SCR ASM content with palette injection for CPC Classic
 * This is a pure generation function that doesn't write to ZIP
 * @returns ASM content string or null if data is too large
 */
export function generateSCRAsmClassic(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  paletteFirmware: number[],
  asmLabel: string
): string | null {
  const scr = exportSCR(indexBuf, modeConfig)
  injectPaletteDataIntoSCR(scr, paletteFirmware, modeConfig.mode)
  const asmResult = toASMData(scr, asmLabel)

  if (typeof asmResult !== 'string') {
    return null
  }

  return getHeader(modeConfig, 'SCR', false) + asmResult
}

export async function exportSCRPlus(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  cpcPlusPaletteValues: number[],
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean
) {
  if (config.content.includeSCR && isStandardMode) {
    const scr = exportSCR(indexBuf, modeConfig)
    injectCPCPlusPaletteIntoSCR(scr, cpcPlusPaletteValues)
    const asmResult = toASMData(scr, asmLabel)
    if (typeof asmResult === 'string') {
      const asmText = getHeader(modeConfig, 'SCR', true) + asmResult
      zip.file(`${asmLabel}.asm`, asmText)
    }
  }
}

export async function exportSCRClassic(
  zip: JSZip,
  indexBuf: Uint8Array,
  paletteFirmware: number[],
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean
) {
  if (config.content.includeSCR && isStandardMode) {
    const asmText = generateSCRAsmClassic(
      indexBuf,
      modeConfig,
      paletteFirmware,
      asmLabel
    )
    if (asmText) {
      zip.file(`${asmLabel}.asm`, asmText)
    }
  }
}
