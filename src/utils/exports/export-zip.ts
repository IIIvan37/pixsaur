import JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { CPCHardware } from '@/libs/types'
import {
  getHardwarePalette,
  injectPaletteDataIntoSCR
} from '@/palettes/cpc-palette'
import { exportLinearAsm } from './export-linear-asm/export-linear.asm'
import { exportSCR } from './export-scr/export-scr'
import { toASMData } from './to-asm-data'
import { paletteToCPCPlusValues, cpcPlusValuesToASM, injectCPCPlusPaletteIntoSCR } from './cpc-plus-format'

const getHeader = (modeConfig: CpcModeConfig, type: string, isCPCPlus: boolean): string => {
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
  reducedPalette?: Array<[number, number, number]>,
  asmLabel = 'pixsaur_data'
) {
  const zip = new JSZip()
  const isCPCPlus = cpcHardware === CPCHardware.PLUS

  const ctx = canvas.getContext('2d')
  const data = ctx?.getImageData(0, 0, canvas.width, canvas?.height)
  if (!data) return

  if (isCPCPlus) {
    // ===== CPC PLUS EXPORT =====
    if (!reducedPalette) {
      throw new Error('Reduced palette is required for CPC Plus export')
    }

    // Pour CPC Plus, les données d'image restent identiques (index de 0-15)
    // mais on utilise une palette CPC Plus au lieu de firmware/hardware
    
    // Convert palette to CPC Plus values
    const cpcPlusPaletteValues = paletteToCPCPlusValues(reducedPalette)
    
    // Export SCR avec palette CPC Plus injectée
    const scr = exportSCR(indexBuf, modeConfig)
    injectCPCPlusPaletteIntoSCR(scr, cpcPlusPaletteValues)
    const asmText = getHeader(modeConfig, 'SCR', true) + toASMData(scr, asmLabel)
    zip.file(`${asmLabel}.asm`, asmText)

    // Export Linear identique
    const linear_asm = exportLinearAsm(indexBuf, modeConfig)
    const linear_asm_text =
      getHeader(modeConfig, 'Linear', true) +
      toASMData(linear_asm, `${asmLabel}-linear`)
    zip.file(`${asmLabel}_linear.asm`, linear_asm_text)

    // Export palette separée en format CPC Plus (16-bit values)
    const cpcPlusPaletteText = getHeader(modeConfig, 'CPC Plus Palette', true) + 
                              cpcPlusValuesToASM(cpcPlusPaletteValues, 'palette_cpc_plus')
    zip.file('palette_cpc_plus.asm', cpcPlusPaletteText)

  } else {
    // ===== CPC CLASSIC EXPORT =====
    const scr = exportSCR(indexBuf, modeConfig)
    injectPaletteDataIntoSCR(scr, paletteFirmware)
    
    const asmText = getHeader(modeConfig, 'SCR', false) + toASMData(scr, asmLabel)
    zip.file(`${asmLabel}.asm`, asmText)

    const linear_asm = exportLinearAsm(indexBuf, modeConfig)
    const linear_asm_text =
      getHeader(modeConfig, 'Linear', false) +
      toASMData(linear_asm, `${asmLabel}-linear`)
    zip.file(`${asmLabel}_linear.asm`, linear_asm_text)

    // Export firmware and hardware palettes for Classic
    const paletteFirmwareText = toASMData(
      new Uint8Array(paletteFirmware),
      'palette_firmware'
    )
    zip.file('palette_firmware.asm', paletteFirmwareText)

    const paletteHardwareText = toASMData(
      new Uint8Array(getHardwarePalette(paletteFirmware)),
      'palette_hardware'
    )
    zip.file('palette_hardware.asm', paletteHardwareText)
  }

  // Common exports for both modes
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png')
  })
  zip.file('pixsaur.png', blob)

  // 5. Finalisation et téléchargement
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pixsaur-export.zip'
  a.click()
  URL.revokeObjectURL(url)
}
