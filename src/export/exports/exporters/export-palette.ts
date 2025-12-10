import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { generatePaletteAsm } from '../asm-generator'
import { cpcPlusValuesToASM } from '../cpc-plus-format'
import type { ExportConfig } from '../types'
import { getHeader } from './utils'

export function exportPalettePlus(
  zip: JSZip,
  cpcPaletteValues: number[],
  modeConfig: CpcModeConfig,
  _config: ExportConfig
) {
  const asm = cpcPlusValuesToASM(cpcPaletteValues, 'Palette')
  const header = getHeader(modeConfig, 'Palette', true)
  zip.file('palette_plus.asm', header + asm)
}

export function exportPalettesClassic(
  zip: JSZip,
  paletteFirmware: number[],
  _config: ExportConfig
) {
  const asm = generatePaletteAsm(paletteFirmware, 'Palette')
  zip.file('palette_classic.asm', asm)
}
