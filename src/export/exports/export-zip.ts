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
  exportSCRPlus,
  exportSna
} from './exporters'
import {
  generateClassicRasterASM,
  generatePlusRasterASM
} from './raster-format'
import type { ExportConfig } from './types'

/**
 * Generated ASM data that can be reused for both ZIP files and SNA export
 */
interface GeneratedAsmData {
  /** Raster ASM content (label: RasterData) */
  rasterAsm?: string
  /** Whether rasters are enabled */
  hasRasters: boolean
  /** CPC Plus palette values (12-bit format) */
  palettePlus?: number[]
}

/**
 * Generate raster ASM data (reusable for ZIP and SNA)
 */
function generateRasterAsmData(
  rasterChanges: RasterChange[],
  imageHeight: number,
  isCPCPlus: boolean,
  paletteFirmware: number[],
  reducedPalette: Array<[number, number, number]> | undefined,
  label: string
): string | undefined {
  if (rasterChanges.length === 0) {
    return undefined
  }

  if (isCPCPlus && reducedPalette) {
    const cpcPlusPalette = paletteToCPCPlusValues(reducedPalette)
    return generatePlusRasterASM(
      rasterChanges,
      imageHeight,
      cpcPlusPalette,
      label
    )
  } else {
    return generateClassicRasterASM(
      rasterChanges,
      imageHeight,
      paletteFirmware,
      label
    )
  }
}

/**
 * Export SNA snapshot file to ZIP using pre-generated ASM data
 */
async function exportSnaToZip(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  isCPCPlus: boolean,
  paletteFirmware: number[],
  asmData: GeneratedAsmData,
  config: ExportConfig,
  asmLabel: string
): Promise<void> {
  if (!config.content.includeSNA) {
    return
  }

  // Export SNA using pre-generated data
  const snaResult = await exportSna({
    indexBuf,
    modeConfig,
    hardware: isCPCPlus ? 'plus' : 'classic',
    paletteFirmware: isCPCPlus ? undefined : paletteFirmware,
    palettePlus: asmData.palettePlus,
    rasterAsm: asmData.rasterAsm,
    hasRasters: asmData.hasRasters,
    filename: asmLabel
  })

  if (snaResult.success && snaResult.snapshot) {
    zip.file(`${config.filename || 'pixsaur'}.sna`, snaResult.snapshot)
  }
}

function exportRasterData(
  zip: JSZip,
  rasterAsm: string | undefined,
  config: ExportConfig
) {
  if (!config.content.includeRasters || !rasterAsm) {
    return
  }

  // Write pre-generated ASM to ZIP
  zip.file('rasters.asm', rasterAsm)
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
  const rasterLabel = config.labels.enabled
    ? config.labels.raster
    : 'RasterData'

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

  // ===== GENERATE SHARED ASM DATA (used for both ZIP files and SNA) =====
  const hasRasters = rasterChanges.length > 0
  const cpcPlusPalette =
    isCPCPlus && reducedPalette
      ? paletteToCPCPlusValues(reducedPalette)
      : undefined

  // Generate raster ASM once (reused for ZIP and SNA)
  const rasterAsm = generateRasterAsmData(
    rasterChanges,
    modeConfig.height,
    isCPCPlus,
    paletteFirmware,
    reducedPalette,
    rasterLabel
  )

  // Prepare shared ASM data for SNA export
  const asmData: GeneratedAsmData = {
    rasterAsm,
    hasRasters,
    palettePlus: cpcPlusPalette
  }

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

    // Export rasters (using pre-generated ASM)
    exportRasterData(zip, rasterAsm, config)
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

    // Export rasters (using pre-generated ASM)
    exportRasterData(zip, rasterAsm, config)
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

  // Export SNA snapshot if enabled (using pre-generated ASM data)
  await exportSnaToZip(
    zip,
    indexBuf,
    modeConfig,
    isCPCPlus,
    paletteFirmware,
    asmData,
    config,
    asmLabel
  )

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
