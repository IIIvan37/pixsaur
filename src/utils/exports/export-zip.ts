import JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { CPCHardware } from '@/libs/types'
import type { ExportConfig } from './types'
import {
  getHardwarePalette,
  injectPaletteDataIntoSCR
} from '@/palettes/cpc-palette'
import {
  cpcPlusValuesToASM,
  injectCPCPlusPaletteIntoSCR,
  paletteToCPCPlusValues
} from './cpc-plus-format'
import { exportLinearAsm } from './export-linear-asm/export-linear.asm'
import { exportSCR } from './export-scr/export-scr'
import { toASMData } from './to-asm-data'

const getHeader = (
  modeConfig: CpcModeConfig,
  type: string,
  isCPCPlus: boolean
): string => {
  const pixelsPerByte = [2, 4, 8][modeConfig.mode]
  const hardwareType = isCPCPlus ? 'CPC+' : 'CPC Classic'
  return `; ${type} Data created with Pixsaur - ${hardwareType}
; Mode ${modeConfig.mode} ${modeConfig.overscan ? 'Overscan' : ''} 
; ${modeConfig.width}x${modeConfig.height} pixels, ${modeConfig.width / pixelsPerByte}x${modeConfig.height} bytes.\n\n`
}

export async function exportZip(
  indexBuf: Uint8Array,
  paletteFirmware: number[],
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig,
  cpcHardware: CPCHardware,
  reducedPalette: Array<[number, number, number]> | undefined,
  config: ExportConfig
) {
  const zip = new JSZip()
  const isCPCPlus = cpcHardware === CPCHardware.PLUS
  
  // Get label from config or use default
  const asmLabel = config.labels.enabled ? config.labels.media : 'pixsaur_data'

  const ctx = canvas.getContext('2d')
  const data = ctx?.getImageData(0, 0, canvas.width, canvas?.height)
  if (!data) return

  if (isCPCPlus) {
    // ===== CPC PLUS EXPORT =====
    if (!reducedPalette) {
      throw new Error('Reduced palette is required for CPC Plus export')
    }

    // Convert palette to CPC Plus values
    const cpcPlusPaletteValues = paletteToCPCPlusValues(reducedPalette)

    // Export SCR if enabled
    if (config.content.includeSCR) {
      const scr = exportSCR(indexBuf, modeConfig)
      injectCPCPlusPaletteIntoSCR(scr, cpcPlusPaletteValues)
      const asmText =
        getHeader(modeConfig, 'SCR', true) + toASMData(scr, asmLabel)
      zip.file(`${asmLabel}.asm`, asmText)
    }

    // Export Linear if enabled
    if (config.content.includeLinear) {
      const linear_asm = exportLinearAsm(indexBuf, modeConfig)
      const linear_asm_text =
        getHeader(modeConfig, 'Linear', true) +
        toASMData(linear_asm, `${asmLabel}_linear`)
      zip.file(`${asmLabel}_linear.asm`, linear_asm_text)
    }

    // Export palette if enabled
    if (config.content.includePalettes) {
      const paletteLabel = config.labels.enabled ? config.labels.palette : 'palette_cpc_plus'
      const cpcPlusPaletteText =
        getHeader(modeConfig, 'CPC Plus Palette', true) +
        cpcPlusValuesToASM(cpcPlusPaletteValues, paletteLabel)
      zip.file(`${paletteLabel}.asm`, cpcPlusPaletteText)
    }
  } else {
    // ===== CPC CLASSIC EXPORT =====
    
    // Export SCR if enabled
    if (config.content.includeSCR) {
      const scr = exportSCR(indexBuf, modeConfig)
      injectPaletteDataIntoSCR(scr, paletteFirmware)
      const asmText =
        getHeader(modeConfig, 'SCR', false) + toASMData(scr, asmLabel)
      zip.file(`${asmLabel}.asm`, asmText)
    }

    // Export Linear if enabled
    if (config.content.includeLinear) {
      const linear_asm = exportLinearAsm(indexBuf, modeConfig)
      const linear_asm_text =
        getHeader(modeConfig, 'Linear', false) +
        toASMData(linear_asm, `${asmLabel}_linear`)
      zip.file(`${asmLabel}_linear.asm`, linear_asm_text)
    }

    // Export firmware and hardware palettes if enabled
    if (config.content.includePalettes) {
      const paletteLabel = config.labels.enabled ? config.labels.palette : 'palette'
      
      const paletteFirmwareText = toASMData(
        new Uint8Array(paletteFirmware),
        `${paletteLabel}_firmware`
      )
      zip.file(`${paletteLabel}_firmware.asm`, paletteFirmwareText)

      const paletteHardwareText = toASMData(
        new Uint8Array(getHardwarePalette(paletteFirmware)),
        `${paletteLabel}_hardware`
      )
      zip.file(`${paletteLabel}_hardware.asm`, paletteHardwareText)
    }
  }

  // Export PNG if enabled
  if (config.content.includePNG) {
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png')
    })
    zip.file('pixsaur.png', blob)
  }

  // 5. Finalisation et téléchargement
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${config.filename || 'pixsaur-export'}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
