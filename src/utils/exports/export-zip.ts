import JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { CPCHardware } from '@/libs/types'
import { paletteToCPCPlusValues } from './cpc-plus-format'
import { saveZipFileTauri } from './export-tauri'
import {
  exportDsk,
  exportLinearData,
  exportPalettePlus,
  exportPalettesClassic,
  exportPNGData,
  exportSCRClassic,
  exportSCRPlus
} from './exporters'
import type { ExportConfig } from './types'

async function exportCPCPlusData(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  reducedPalette: Array<[number, number, number]>,
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean
) {
  const cpcPlusPaletteValues = paletteToCPCPlusValues(reducedPalette)

  await exportSCRPlus(
    zip,
    indexBuf,
    modeConfig,
    cpcPlusPaletteValues,
    config,
    asmLabel,
    isStandardMode
  )

  await exportLinearData(zip, indexBuf, modeConfig, config, asmLabel, true)

  exportPalettePlus(zip, cpcPlusPaletteValues, modeConfig, config)

  // Export DSK if enabled
  await exportDsk(zip, indexBuf, modeConfig, config, asmLabel, isStandardMode)
}

async function exportCPCClassicData(
  zip: JSZip,
  indexBuf: Uint8Array,
  paletteFirmware: number[],
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean
) {
  await exportSCRClassic(
    zip,
    indexBuf,
    paletteFirmware,
    modeConfig,
    config,
    asmLabel,
    isStandardMode
  )

  await exportLinearData(zip, indexBuf, modeConfig, config, asmLabel, false)

  exportPalettesClassic(zip, paletteFirmware, config)

  // Export DSK if enabled
  await exportDsk(zip, indexBuf, modeConfig, config, asmLabel, isStandardMode)
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

  // Check if mode is standard (required for SCR format)
  // SCR format requires standard 16KB screen dimensions
  const isStandardMode =
    !modeConfig.overscan &&
    ((modeConfig.mode === 0 &&
      modeConfig.width === 160 &&
      modeConfig.height === 200) ||
      (modeConfig.mode === 1 &&
        modeConfig.width === 320 &&
        modeConfig.height === 200) ||
      (modeConfig.mode === 2 &&
        modeConfig.width === 640 &&
        modeConfig.height === 200))

  if (isCPCPlus) {
    // ===== CPC PLUS EXPORT =====
    if (!reducedPalette) {
      throw new Error('Reduced palette is required for CPC Plus export')
    }

    await exportCPCPlusData(
      zip,
      indexBuf,
      modeConfig,
      reducedPalette,
      config,
      asmLabel,
      isStandardMode
    )
  } else {
    // ===== CPC CLASSIC EXPORT =====

    await exportCPCClassicData(
      zip,
      indexBuf,
      paletteFirmware,
      modeConfig,
      config,
      asmLabel,
      isStandardMode
    )
  }

  // Export PNG if enabled
  if (config.content.includePNG || config.content.includePNGCorrected) {
    await exportPNGData(zip, canvas, modeConfig, config)
  }

  // 5. Finalisation et téléchargement
  const zipBlob = await zip.generateAsync({ type: 'blob' })

  // Check if running in Tauri (desktop) or web
  const isTauri =
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis

  if (isTauri) {
    // Use Tauri's native file dialog and save
    await saveZipFileTauri(
      zipBlob,
      `${config.filename || 'pixsaur-export'}.zip`
    )
  } else {
    // Use browser download
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${config.filename || 'pixsaur-export'}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }
}
