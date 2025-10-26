import JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { CPCHardware } from '@/libs/types'
import {
  getHardwarePalette,
  injectPaletteDataIntoSCR
} from '@/palettes/cpc-palette'
import { logger } from '@/utils/logger'
import {
  cpcPlusValuesToASM,
  injectCPCPlusPaletteIntoSCR,
  paletteToCPCPlusValues
} from './cpc-plus-format'
import { exportLinearAsm } from './export-linear-asm/export-linear.asm'
import { exportSCR } from './export-scr/export-scr'
import { toASMData } from './to-asm-data'
import type { ExportConfig } from './types'

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

    // Convert palette to CPC Plus values
    const cpcPlusPaletteValues = paletteToCPCPlusValues(reducedPalette)

    // Export SCR only if standard mode
    if (config.content.includeSCR && isStandardMode) {
      const scr = exportSCR(indexBuf, modeConfig)
      injectCPCPlusPaletteIntoSCR(scr, cpcPlusPaletteValues)
      const asmResult = toASMData(scr, asmLabel)
      if (typeof asmResult === 'string') {
        const asmText = getHeader(modeConfig, 'SCR', true) + asmResult
        zip.file(`${asmLabel}.asm`, asmText)
      }
    }

    // Export Linear if enabled
    if (config.content.includeLinear) {
      const linear_asm = exportLinearAsm(indexBuf, modeConfig)
      const asmResult = toASMData(linear_asm, `${asmLabel}_linear`)

      if (typeof asmResult === 'string') {
        // Single file
        const linear_asm_text =
          getHeader(modeConfig, 'Linear', true) + asmResult
        zip.file(`${asmLabel}_linear.asm`, linear_asm_text)
      } else {
        // Multiple chunked files
        const header = getHeader(modeConfig, 'Linear', true)
        for (const chunk of asmResult) {
          zip.file(chunk.filename, header + chunk.content)
        }
      }
    }

    // Export palette if enabled
    if (config.content.includePalettes) {
      const paletteLabel = config.labels.enabled
        ? config.labels.palette
        : 'palette_cpc_plus'
      const cpcPlusPaletteText =
        getHeader(modeConfig, 'CPC Plus Palette', true) +
        cpcPlusValuesToASM(cpcPlusPaletteValues, paletteLabel)
      zip.file(`${paletteLabel}.asm`, cpcPlusPaletteText)
    }
  } else {
    // ===== CPC CLASSIC EXPORT =====

    // Export SCR only if standard mode
    if (config.content.includeSCR && isStandardMode) {
      const scr = exportSCR(indexBuf, modeConfig)
      injectPaletteDataIntoSCR(scr, paletteFirmware)
      const asmResult = toASMData(scr, asmLabel)
      if (typeof asmResult === 'string') {
        const asmText = getHeader(modeConfig, 'SCR', false) + asmResult
        zip.file(`${asmLabel}.asm`, asmText)
      }
    }

    // Export Linear if enabled
    if (config.content.includeLinear) {
      const linear_asm = exportLinearAsm(indexBuf, modeConfig)
      const asmResult = toASMData(linear_asm, `${asmLabel}_linear`)

      if (typeof asmResult === 'string') {
        // Single file
        const linear_asm_text =
          getHeader(modeConfig, 'Linear', false) + asmResult
        zip.file(`${asmLabel}_linear.asm`, linear_asm_text)
      } else {
        // Multiple chunked files
        const header = getHeader(modeConfig, 'Linear', false)
        for (const chunk of asmResult) {
          zip.file(chunk.filename, header + chunk.content)
        }
      }
    }

    // Export firmware and hardware palettes if enabled
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

  // Export PNG if enabled
  if (config.content.includePNG || config.content.includePNGCorrected) {
    // Calculate aspect ratio correction based on mode
    // Mode 0: 2 pixels/byte, PAR = 2.0 (wide pixels) - double width
    // Mode 1: 4 pixels/byte, PAR = 1.0 (square pixels) - no change
    // Mode 2: 8 pixels/byte, narrow pixels - double height instead
    const widthMultiplier = modeConfig.mode === 0 ? 2 : 1
    const heightMultiplier = modeConfig.mode === 2 ? 2 : 1

    // Export original PNG (square pixels)
    if (config.content.includePNG) {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
      })
      zip.file('pixsaur.png', blob)
    }

    // Export PNG with correct aspect ratio
    if (config.content.includePNGCorrected) {
      logger.debug('Creating corrected aspect PNG:', {
        originalWidth: canvas.width,
        originalHeight: canvas.height,
        mode: modeConfig.mode,
        widthMultiplier,
        heightMultiplier,
        correctedWidth: canvas.width * widthMultiplier,
        correctedHeight: canvas.height * heightMultiplier
      })

      const correctedCanvas = document.createElement('canvas')
      const correctedWidth = canvas.width * widthMultiplier
      const correctedHeight = canvas.height * heightMultiplier
      correctedCanvas.width = correctedWidth
      correctedCanvas.height = correctedHeight
      const correctedCtx = correctedCanvas.getContext('2d', {
        alpha: false
      })
      if (correctedCtx) {
        // Fill with black background first
        correctedCtx.fillStyle = '#000000'
        correctedCtx.fillRect(0, 0, correctedWidth, correctedHeight)

        // Disable smoothing for pixel-perfect scaling
        correctedCtx.imageSmoothingEnabled = false

        // Draw the original canvas scaled
        correctedCtx.drawImage(
          canvas,
          0,
          0,
          canvas.width,
          canvas.height,
          0,
          0,
          correctedWidth,
          correctedHeight
        )

        const correctedBlob = await new Promise<Blob | null>((resolve) => {
          correctedCanvas.toBlob(resolve, 'image/png')
        })
        logger.debug('Corrected blob size:', correctedBlob?.size)
        if (correctedBlob) {
          zip.file('pixsaur_corrected_aspect.png', correctedBlob)
        }
      }
    }
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
