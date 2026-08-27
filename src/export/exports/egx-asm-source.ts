/**
 * EGX ASM source production — the one place that turns an EGX index buffer
 * into an assemblable Z80 source.
 *
 * The same procedure (pick a template by overscan × hardware, emit the
 * palette, slice the image data, assemble) was written out once per export
 * target. It lives here now; the exporters only decide what to do with the
 * source they get back.
 */

import type { EGXConfig } from '@/libs/pixsaur-egx'
import type { CPCHardware } from '@/libs/types'
import { paletteToCPCPlusValues } from './cpc-plus-format'
import { exportEgxLinear, exportEgxSCR, isEgxOverscan } from './export-scr'
import { hardwarePaletteAsm, plusPaletteAsm } from './palette-asm'
import {
  assembleEgxSnaSource,
  generateEgxOverscanSnaTemplate,
  generateEgxPlusOverscanSnaTemplate,
  generateEgxPlusSnaTemplate,
  generateEgxSnaTemplate
} from './templates'
import { toAsmDataString } from './to-asm-data'

export interface EgxAsmSourceInput {
  indexBuf: Uint8Array
  width: number
  height: number
  egxConfig: EGXConfig
  /** CPC Classic palette, as firmware indices. Required for `'classic'`. */
  paletteFirmware?: number[]
  /** CPC Plus palette, as RGB triplets. Required for `'plus'`. */
  paletteRgb?: Array<[number, number, number]>
  /** Defaults to `'classic'`. */
  hardware?: CPCHardware
}

/** EGX1 addresses the 16 mode-0 slots; EGX2 only the 4 mode-1 ones. */
function egxColorCount(egxConfig: EGXConfig): number {
  return egxConfig.type === 'egx1' ? 16 : 4
}

/**
 * Build the complete EGX ASM source, or `null` when the palette the requested
 * hardware needs is missing.
 */
export function egxAsmSource(input: EgxAsmSourceInput): string | null {
  const { indexBuf, width, height, egxConfig, hardware } = input

  const overscan = isEgxOverscan(width, height, egxConfig.type)
  const colorCount = egxColorCount(egxConfig)

  let template: string
  let paletteAsm: string

  if (hardware === 'plus') {
    if (!input.paletteRgb) return null

    template = overscan
      ? generateEgxPlusOverscanSnaTemplate({ egxConfig, height, hardware })
      : generateEgxPlusSnaTemplate({ egxConfig, height, hardware })

    const cpcPlusValues = paletteToCPCPlusValues(
      input.paletteRgb.slice(0, colorCount)
    )
    paletteAsm = plusPaletteAsm(cpcPlusValues, {
      label: 'Palette_Plus',
      colorCount
    })
  } else {
    if (!input.paletteFirmware) return null

    template = overscan
      ? generateEgxOverscanSnaTemplate({ egxConfig, height })
      : generateEgxSnaTemplate({ egxConfig, height })

    paletteAsm = hardwarePaletteAsm(input.paletteFirmware, {
      label: 'Palette_Hardware',
      colorCount
    })
  }

  if (!overscan) {
    const imageAsm = toAsmDataString(
      exportEgxSCR(indexBuf, width, height, egxConfig),
      'ImageData'
    )

    return assembleEgxSnaSource(template, { paletteAsm, imageAsm })
  }

  // Overscan holds linear data split across two banks.
  const linearData = exportEgxLinear(indexBuf, width, height, egxConfig)
  const halfSize = Math.floor(linearData.length / 2)

  const imageAsm = toAsmDataString(
    linearData.slice(0, halfSize),
    'ImageData_chunk_0'
  )
  const imageAsm2 = toAsmDataString(
    linearData.slice(halfSize),
    'ImageData_chunk_1'
  )

  return assembleEgxSnaSource(
    template,
    { paletteAsm, imageAsm, imageAsm2 },
    { overscan: true }
  )
}
