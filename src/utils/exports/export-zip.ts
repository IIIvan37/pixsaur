import JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { CPCHardware } from '@/libs/types'
import {
  getHardwarePalette,
  injectPaletteDataIntoSCR
} from '@/palettes/cpc-palette'
import { getPixelsPerByte } from '@/utils/cpc-calculations'
import {
  cpcPlusValuesToASM,
  injectCPCPlusPaletteIntoSCR,
  paletteToCPCPlusValues
} from './cpc-plus-format'
import { generateScrDskTemplate } from './dsk-templates'
import { exportLinearAsm } from './export-linear-asm/export-linear.asm'
import {
  canvasToPNGBlob,
  createCorrectedAspectCanvas,
  createSquarePixelsCanvas
} from './export-png-utils'
import { exportSCR } from './export-scr/export-scr'
import { saveZipFileTauri } from './export-tauri'
import { toASMData } from './to-asm-data'
import type { ExportConfig } from './types'

const getHeader = (
  modeConfig: CpcModeConfig,
  type: string,
  isCPCPlus: boolean
): string => {
  const pixelsPerByte = getPixelsPerByte(modeConfig.mode)
  const hardwareType = isCPCPlus ? 'CPC+' : 'CPC Classic'
  const paletteInfo =
    type === 'SCR'
      ? `; Palette data injected at offset 2000 (border at 2000, firmware colors at 2001-2016, hardware colors at 2017-2033)\n`
      : ''
  return `; ${type} Data created with Pixsaur - ${hardwareType}
; Mode ${modeConfig.mode} ${modeConfig.overscan ? 'Overscan' : ''} 
; ${modeConfig.width}x${modeConfig.height} pixels, ${modeConfig.width / pixelsPerByte}x${modeConfig.height} bytes.
${paletteInfo}\n`
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

/**
 * Export PNG with native CPC dimensions (1:1 square pixels)
 */
async function exportSquarePixelsPNG(
  zip: JSZip,
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig
) {
  const nativeCanvas = createSquarePixelsCanvas(canvas, modeConfig)
  const blob = await canvasToPNGBlob(nativeCanvas)
  zip.file('pixsaur.png', blob)
}

/**
 * Export PNG with corrected CPC aspect ratio
 */
async function exportCorrectedAspectPNG(
  zip: JSZip,
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig
) {
  const correctedCanvas = createCorrectedAspectCanvas(canvas, modeConfig)
  const correctedBlob = await canvasToPNGBlob(correctedCanvas)
  zip.file('pixsaur_corrected_aspect.png', correctedBlob)
}

async function exportPNGData(
  zip: JSZip,
  canvas: HTMLCanvasElement,
  modeConfig: CpcModeConfig,
  config: ExportConfig
) {
  // Export original PNG (square pixels - 1:1 ratio)
  if (config.content.includePNG) {
    await exportSquarePixelsPNG(zip, canvas, modeConfig)
  }

  // Export PNG with correct aspect ratio
  if (config.content.includePNGCorrected) {
    await exportCorrectedAspectPNG(zip, canvas, modeConfig)
  }
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

async function exportLinearData(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  asmLabel: string,
  isCPCPlus: boolean
) {
  if (config.content.includeLinear) {
    const linear_asm = exportLinearAsm(indexBuf, modeConfig)
    const asmResult = toASMData(linear_asm, `${asmLabel}_linear`)

    if (typeof asmResult === 'string') {
      // Single file
      const linear_asm_text =
        getHeader(modeConfig, 'Linear', isCPCPlus) + asmResult
      zip.file(`${asmLabel}_linear.asm`, linear_asm_text)
    } else {
      // Multiple chunked files
      const header = getHeader(modeConfig, 'Linear', isCPCPlus)
      for (const chunk of asmResult) {
        zip.file(chunk.filename, header + chunk.content)
      }
    }
  }
}

async function exportSCRPlus(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  cpcPlusPaletteValues: number[],
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean
) {
  if (config.content.includeSCR && isStandardMode) {
    const scr = exportSCR(indexBuf, modeConfig)
    injectCPCPlusPaletteIntoSCR(scr, cpcPlusPaletteValues)
    const asmResult = toASMData(scr, asmLabel)
    if (typeof asmResult === 'string') {
      const asmText = getHeader(modeConfig, 'SCR', true) + asmResult
      zip.file(`${asmLabel}.asm`, asmText)
    }
  }
}

async function exportSCRClassic(
  zip: JSZip,
  indexBuf: Uint8Array,
  paletteFirmware: number[],
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean
) {
  if (config.content.includeSCR && isStandardMode) {
    const scr = exportSCR(indexBuf, modeConfig)
    injectPaletteDataIntoSCR(scr, paletteFirmware)
    const asmResult = toASMData(scr, asmLabel)
    if (typeof asmResult === 'string') {
      const asmText = getHeader(modeConfig, 'SCR', false) + asmResult
      zip.file(`${asmLabel}.asm`, asmText)
    }
  }
}

function exportPalettePlus(
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

function exportPalettesClassic(
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

/**
 * Export DSK file with SCR data
 * Generates a DSK disk image containing the screen file
 */
async function exportDsk(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean
) {
  if (!config.content.includeDSK || !isStandardMode) {
    return
  }

  // 1. Generate SCR ASM file (without palette injection for DSK)
  const scr = exportSCR(indexBuf, modeConfig)
  const asmResult = toASMData(scr, asmLabel)

  if (typeof asmResult !== 'string') {
    console.warn(
      'DSK export: SCR data is too large and was chunked. DSK export skipped.'
    )
    return
  }

  const scrAsmFilename = `${asmLabel}.asm`
  const scrAsmContent = getHeader(modeConfig, 'SCR', false) + asmResult
  const dskFilename = `${config.filename || 'pixsaur'}.dsk`

  // 2. Generate DSK template that includes the SCR ASM
  const dskTemplateCode = generateScrDskTemplate({
    scrAsmFilename,
    scrLabel: asmLabel,
    dskFilename,
    screenFilename: 'IMAGE.SCR'
  })

  // 3. Assemble with RASM to create the DSK
  // We need to write the SCR file before assembling
  try {
    // Create RASM instance and get access to the module
    const { createRasmInstance } = await import('@/libs/rasm-wasm')
    const rasmInstance = await createRasmInstance()
    const rasmModule = rasmInstance.getModule()

    // Write the SCR ASM file to RASM's virtual filesystem
    rasmModule.FS.writeFile(`/${scrAsmFilename}`, scrAsmContent)
    console.log(`[DSK] Wrote ${scrAsmFilename} to RASM virtual filesystem`)

    // Now assemble the DSK template
    // Pass the DSK filename so RASM knows where to look for it
    const result = await rasmInstance.assemble(dskTemplateCode, {
      outputFile: 'output.bin',
      exportType: 'dsk',
      dskFile: dskFilename
    })

    if (result.success && result.dsk) {
      // Add the DSK file to the ZIP
      zip.file(dskFilename, result.dsk)
      console.log('DSK file generated successfully')
    } else {
      console.error('DSK generation failed:', result.output)
    }
  } catch (error) {
    console.error('Error during DSK assembly:', error)
  }
}
