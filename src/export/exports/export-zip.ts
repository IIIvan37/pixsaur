import JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { CPCHardware } from '@/libs/types'
import { isTauri, saveZipFileTauri } from '@/tauri'
import { paletteToCPCPlusValues } from './cpc-plus-format'
import type { PNGExportData } from './exporters'
import {
  exportLinearData,
  exportPalettePlus,
  exportPalettesClassic,
  exportPNGData,
  exportSCRClassic,
  exportSCRPlus
} from './exporters'
import { exportDebugPNG } from './exporters/export-debug-png'
import {
  generateClassicRasterASM,
  generatePlusRasterASM
} from './raster-format'
import type { ExportConfig } from './types'

function exportRasterData(
  zip: JSZip,
  rasterChanges: RasterChange[],
  imageHeight: number,
  isCPCPlus: boolean,
  basePalette: number[],
  config: ExportConfig
) {
  if (!config.content.includeRasters || rasterChanges.length === 0) {
    return
  }

  const label = config.labels.enabled ? config.labels.raster : 'RasterData'

  // Generate ASM file (use RASM to assemble if binary is needed)
  const asmContent = isCPCPlus
    ? generatePlusRasterASM(rasterChanges, imageHeight, basePalette, label)
    : generateClassicRasterASM(rasterChanges, imageHeight, basePalette, label)
  zip.file('rasters.asm', asmContent)
}

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
}

export async function exportZip(
  indexBuf: Uint8Array,
  paletteFirmware: number[],
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig,
  cpcHardware: CPCHardware,
  reducedPalette: Array<[number, number, number]> | undefined,
  config: ExportConfig,
  rasterChanges: RasterChange[] = [],
  previewImage?: ImageData
): Promise<boolean> {
  const zip = new JSZip()
  const isCPCPlus = cpcHardware === CPCHardware.PLUS

  // Get label from config or use default
  const asmLabel = config.labels.enabled ? config.labels.media : 'pixsaur_data'

  const ctx = canvas.getContext('2d')
  const data = ctx?.getImageData(0, 0, canvas.width, canvas?.height)
  if (!data) return false

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

    // Raster mode: keep slots 0-3 as black (will be set by rasters each line)
    // The reducedPalette already has [0,0,0] for slots 0-3 and fixed colors for 4-15

    await exportCPCPlusData(
      zip,
      indexBuf,
      modeConfig,
      reducedPalette,
      config,
      asmLabel,
      isStandardMode
    )

    // Export rasters if enabled (for Plus, convert palette to CPC Plus values)
    const cpcPlusPalette = paletteToCPCPlusValues(reducedPalette)
    exportRasterData(
      zip,
      rasterChanges,
      modeConfig.height,
      isCPCPlus,
      cpcPlusPalette,
      config
    )

    // Export debug PNG for raster validation
    if (rasterChanges.length > 0) {
      await exportDebugPNG(
        zip,
        indexBuf,
        modeConfig.width,
        modeConfig.height,
        reducedPalette,
        rasterChanges,
        modeConfig
      )
    }
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

    // Export rasters if enabled (for Classic, use firmware palette)
    exportRasterData(
      zip,
      rasterChanges,
      modeConfig.height,
      isCPCPlus,
      paletteFirmware,
      config
    )
  }

  // Export PNG if enabled
  if (config.content.includePNG || config.content.includePNGCorrected) {
    // Use previewImage directly if available (has rasters already applied)
    // This is the same rendering as double-click on preview canvas
    const rasterData: PNGExportData | undefined = previewImage
      ? { previewImage }
      : undefined

    await exportPNGData(zip, canvas, modeConfig, config, rasterData)
  }

  // 5. Finalisation et téléchargement
  const zipBlob = await zip.generateAsync({ type: 'blob' })

  // Check if running in Tauri (desktop) or web
  if (isTauri()) {
    // Use Tauri's native file dialog and save
    const success = await saveZipFileTauri(
      zipBlob,
      `${config.filename || 'pixsaur-export'}.zip`
    )
    return success
  } else {
    // Use browser download
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${config.filename || 'pixsaur-export'}.zip`
    a.click()
    URL.revokeObjectURL(url)
    return true
  }
}
