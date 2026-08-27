import JSZip from 'jszip'
import { createLogger } from '@/core'
import { type CpcModeConfig, screenCapability } from '@/domain/cpc'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCHardware } from '@/libs/types'
import { assembleSnapshot } from './assemble-snapshot'
import { paletteToCPCPlusValues } from './cpc-plus-format'
import { egxAsmSource } from './egx-asm-source'
import { exportEgxLinear, exportEgxSCR } from './export-scr'
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
import { toASMData } from './to-asm-data'
import type { ExportConfig } from './types'

const exportLogger = createLogger({ prefix: '[ZIP Export]' })

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

interface ExportSnaToZipParams {
  zip: JSZip
  indexBuf: Uint8Array
  modeConfig: CpcModeConfig
  isCPCPlus: boolean
  paletteFirmware: number[]
  asmData: GeneratedAsmData
  config: ExportConfig
  asmLabel: string
}

interface ExportEgxSnaToZipParams {
  zip: JSZip
  indexBuf: Uint8Array
  egxConfig: EGXConfig
  width: number
  height: number
  /** Firmware palette for Classic */
  paletteFirmware: number[]
  /** RGB palette for Plus */
  reducedPalette?: Array<[number, number, number]>
  /** CPC hardware type */
  isCPCPlus: boolean
  config: ExportConfig
}

interface ExportZipParams {
  indexBuf: Uint8Array
  paletteFirmware: number[]
  canvas: HTMLCanvasElement
  modeConfig: CpcModeConfig
  cpcHardware: CPCHardware
  reducedPalette: Array<[number, number, number]> | undefined
  config: ExportConfig
  rasterChanges?: RasterChange[]
  previewImage?: ImageData
  egxConfig?: EGXConfig
  /** EGX buffer width (320 for EGX1, 640 for EGX2) */
  egxWidth?: number
  /** EGX buffer height (200) */
  egxHeight?: number
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
async function exportSnaToZip(params: ExportSnaToZipParams): Promise<void> {
  const {
    zip,
    indexBuf,
    modeConfig,
    isCPCPlus,
    paletteFirmware,
    asmData,
    config,
    asmLabel
  } = params

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

    // Also export ASM source for debugging/modification
    if (snaResult.asmSource) {
      zip.file(`${config.filename || 'pixsaur'}_sna.asm`, snaResult.asmSource)
    }
  }
}

/**
 * Export EGX SNA snapshot file to ZIP
 */
async function exportEgxSnaToZip(
  params: ExportEgxSnaToZipParams
): Promise<void> {
  const {
    zip,
    indexBuf,
    egxConfig,
    width,
    height,
    paletteFirmware,
    reducedPalette,
    isCPCPlus,
    config
  } = params

  const asmSource = egxAsmSource({
    indexBuf,
    width,
    height,
    egxConfig,
    paletteFirmware,
    paletteRgb: reducedPalette,
    // Plus needs the RGB palette; without it the Classic path still works.
    hardware: isCPCPlus && reducedPalette ? 'plus' : 'classic'
  })

  if (!asmSource) return

  const filename = config.filename || 'pixsaur'
  const { snapshot, error } = await assembleSnapshot(asmSource, filename)

  if (!snapshot) {
    exportLogger.error('EGX SNA assembly failed', { error })
    return
  }

  zip.file(`${filename}.sna`, snapshot)
  // Also export ASM source for debugging/modification
  zip.file(`${filename}_sna.asm`, asmSource)
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

/**
 * Build the export ZIP and return it as a {@link Blob}. Persisting the blob
 * (browser download vs desktop save dialog) is the caller's responsibility via
 * a `FileSink` — see `src/export/application/`. Returns `null` when the canvas
 * pixels can't be read back.
 */
export async function buildExportZipBlob(
  params: ExportZipParams
): Promise<Blob | null> {
  const {
    indexBuf,
    paletteFirmware,
    canvas,
    modeConfig,
    cpcHardware,
    reducedPalette,
    config,
    rasterChanges = [],
    previewImage,
    egxConfig,
    egxWidth,
    egxHeight
  } = params

  const zip = new JSZip()
  const isCPCPlus = cpcHardware === 'plus'
  const isEgxMode = !!egxConfig

  // For EGX, use EGX dimensions; otherwise use modeConfig
  const effectiveWidth = isEgxMode && egxWidth ? egxWidth : modeConfig.width
  const effectiveHeight = isEgxMode && egxHeight ? egxHeight : modeConfig.height

  // Get label from config or use default
  const asmLabel = config.labels.enabled ? config.labels.media : 'pixsaur_data'
  const rasterLabel = config.labels.enabled
    ? config.labels.raster
    : 'RasterData'

  const ctx = canvas.getContext('2d')
  const data = ctx?.getImageData(0, 0, canvas.width, canvas?.height)
  if (!data) return null

  // What this screen can produce — the same rule the export dialog reads.
  const { isStandard: isStandardMode, canExportScr: canExportSCR } =
    screenCapability(
      modeConfig,
      isEgxMode
        ? {
            type: egxConfig.type,
            width: effectiveWidth,
            height: effectiveHeight
          }
        : null
    )

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

  if (isEgxMode) {
    // ===== EGX MODE EXPORT =====
    // Generate EGX SCR (line-by-line mode alternation)
    if (isStandardMode && config.content.includeSCR) {
      const egxScrData = exportEgxSCR(
        indexBuf,
        effectiveWidth,
        effectiveHeight,
        egxConfig
      )

      // Add SCR binary file
      zip.file(`${config.filename}.scr`, egxScrData)

      // Add SCR ASM file
      const scrAsmContent = toASMData(egxScrData, asmLabel)
      if (typeof scrAsmContent === 'string') {
        zip.file(`${asmLabel}_scr.asm`, scrAsmContent)
      } else {
        // Handle chunked output (shouldn't happen for 16KB SCR)
        for (const chunk of scrAsmContent) {
          zip.file(chunk.filename, chunk.content)
        }
      }
    }

    // Export linear data
    if (config.content.includeLinear) {
      const egxLinearData = exportEgxLinear(
        indexBuf,
        effectiveWidth,
        effectiveHeight,
        egxConfig
      )

      // Add linear ASM file
      const linearAsmContent = toASMData(egxLinearData, `${asmLabel}_linear`)
      if (typeof linearAsmContent === 'string') {
        zip.file(`${asmLabel}_linear.asm`, linearAsmContent)
      } else {
        for (const chunk of linearAsmContent) {
          zip.file(chunk.filename, chunk.content)
        }
      }
    }

    // Export palettes
    if (config.content.includePalettes) {
      if (isCPCPlus && reducedPalette) {
        const cpcPlusValues = paletteToCPCPlusValues(reducedPalette)
        exportPalettePlus(zip, cpcPlusValues, modeConfig, config)
      } else {
        exportPalettesClassic(zip, paletteFirmware, config)
      }
    }

    // Export EGX SNA
    if (config.content.includeSNA) {
      await exportEgxSnaToZip({
        zip,
        indexBuf,
        egxConfig,
        width: effectiveWidth,
        height: effectiveHeight,
        paletteFirmware,
        reducedPalette,
        isCPCPlus,
        config
      })
    }
  } else if (isCPCPlus) {
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
      canExportSCR
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
      canExportSCR
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
  // Skip for EGX mode - it has its own SNA export in the isEgxMode block
  if (!isEgxMode) {
    await exportSnaToZip({
      zip,
      indexBuf,
      modeConfig,
      isCPCPlus,
      paletteFirmware,
      asmData,
      config,
      asmLabel
    })
  }

  // Finalisation: hand the blob back to the caller's FileSink for persistence.
  return zip.generateAsync({ type: 'blob' })
}
