import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/domain/cpc'
import { generatePaletteAsm } from '../asm-generator'
import { cpcPlusValuesToASM } from '../cpc-plus-format'
import { hardwarePaletteAsm } from '../palette-asm'
import type { ExportConfig } from '../types'
import { getHeader } from './utils'

export function exportPalettePlus(
  zip: JSZip,
  cpcPaletteValues: number[],
  modeConfig: CpcModeConfig,
  config: ExportConfig
) {
  if (!config.content.includePalettes) return
  const asm = cpcPlusValuesToASM(cpcPaletteValues, 'Palette')
  const header = getHeader(modeConfig, 'Palette', true)
  zip.file('palette_plus.asm', header + asm)
}

export function exportPalettesClassic(
  zip: JSZip,
  paletteFirmware: number[],
  config: ExportConfig
) {
  if (!config.content.includePalettes) return
  // Export firmware palette
  const firmwareAsm = generatePaletteAsm(paletteFirmware, 'Palette_Firmware')
  zip.file('palette_firmware.asm', firmwareAsm)

  // Export hardware palette
  const hardwareAsm = hardwarePaletteAsm(paletteFirmware, {
    label: 'Palette_Hardware'
  })
  zip.file('palette_hardware.asm', hardwareAsm)
}
