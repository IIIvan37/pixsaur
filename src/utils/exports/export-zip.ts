import JSZip from 'jszip'
import { toASMData } from './to-asm-data'
import { exportSCR } from './export-scr/export-scr'
import {
  getHardwarePalette,
  injectPaletteDataIntoSCR
} from '@/palettes/cpc-palette'
import { CpcModeConfig } from '@/app/store/config/types'
import { exportLinearAsm } from './export-linear-asm/export-linear.asm'

const getHeader = (modeConfig: CpcModeConfig, type: string): string => {
  const pixelsPerByte = [2, 4, 8][modeConfig.mode]
  return `; ${type} Data created with Pixsaur
; Mode ${modeConfig.mode} ${modeConfig.overscan ? 'Overscan' : ''} 
; ${modeConfig.width}x${modeConfig.height} pixels, ${modeConfig.width / pixelsPerByte}x${modeConfig.height} bytes.\n\n`
}
export async function exportZip(
  indexBuf: Uint8Array,
  paletteFirmware: number[],
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig,
  asmLabel = 'pixsaur_data'
) {
  const zip = new JSZip()

  const ctx = canvas.getContext('2d')
  const data = ctx?.getImageData(0, 0, canvas.width, canvas?.height)
  if (!data) return

  const scr = exportSCR(indexBuf, modeConfig)

  injectPaletteDataIntoSCR(scr, paletteFirmware)
  const asmText = getHeader(modeConfig, 'SCR') + toASMData(scr, asmLabel)

  zip.file(`${asmLabel}.asm`, asmText)

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png')
  })
  zip.file('pixsaur.png', blob)

  const linear_asm = exportLinearAsm(indexBuf, modeConfig)
  const linear_asm_text =
    getHeader(modeConfig, 'Linear') +
    toASMData(linear_asm, `${asmLabel}-linear`)
  zip.file(`${asmLabel}-linear.asm`, linear_asm_text)

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
  // 5. Finalisation et téléchargement
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pixsaur-export.zip'
  a.click()
  URL.revokeObjectURL(url)
}
