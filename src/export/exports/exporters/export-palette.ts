import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/domain/cpc'
import { generatePaletteAsm } from '../asm-generator'
import { firmwareToHardware } from '../cpc-format'
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

/**
 * Generate hardware palette ASM section
 */
function generateHardwarePaletteAsm(
  paletteFirmware: number[],
  label: string
): string {
  const hardwarePalette = paletteFirmware
    .slice(0, 16)
    .map((fw) => firmwareToHardware[fw] ?? 0x54) // Default to black (0x54) if undefined

  const bytes = hardwarePalette
    .map((hw) => `#${hw.toString(16).padStart(2, '0').toUpperCase()}`)
    .join(',')

  return `${label}:
    DB      ${bytes}`
}

export function exportPalettesClassic(
  zip: JSZip,
  paletteFirmware: number[],
  _config: ExportConfig
) {
  // Export firmware palette
  const firmwareAsm = generatePaletteAsm(paletteFirmware, 'Palette_Firmware')
  zip.file('palette_firmware.asm', firmwareAsm)

  // Export hardware palette
  const hardwareAsm = generateHardwarePaletteAsm(
    paletteFirmware,
    'Palette_Hardware'
  )
  zip.file('palette_hardware.asm', hardwareAsm)
}
