import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { getHardwarePalette } from '@/palettes/cpc-palette'
import { cpcPlusValuesToASM } from '../cpc-plus-format'
import { toASMData } from '../to-asm-data'
import type { ExportConfig } from '../types'
import { getHeader } from './utils'

export function exportPalettePlus(
  zip: JSZip,
  cpcPlusPaletteValues: number[],
  modeConfig: CpcModeConfig,
  config: ExportConfig
) {
  if (config.content.includePalettes) {
    const paletteLabel = config.labels.enabled
      ? config.labels.palette
      : 'palette_cpc_plus'
    const cpcPlusPaletteText =
      getHeader(modeConfig, 'CPC Plus Palette', true) +
      cpcPlusValuesToASM(cpcPlusPaletteValues, paletteLabel)
    zip.file(`${paletteLabel}.asm`, cpcPlusPaletteText)
  }
}

export function exportPalettesClassic(
  zip: JSZip,
  paletteFirmware: number[],
  config: ExportConfig
) {
  if (config.content.includePalettes) {
    const paletteLabel = config.labels.enabled
      ? config.labels.palette
      : 'palette'

    const paletteFirmwareResult = toASMData(
      new Uint8Array(paletteFirmware),
      `${paletteLabel}_firmware`
    )
    if (typeof paletteFirmwareResult === 'string') {
      zip.file(`${paletteLabel}_firmware.asm`, paletteFirmwareResult)
    }

    const paletteHardwareResult = toASMData(
      new Uint8Array(getHardwarePalette(paletteFirmware)),
      `${paletteLabel}_hardware`
    )
    if (typeof paletteHardwareResult === 'string') {
      zip.file(`${paletteLabel}_hardware.asm`, paletteHardwareResult)
    }
  }
}
