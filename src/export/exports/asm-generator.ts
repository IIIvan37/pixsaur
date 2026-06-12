/**
 * ASM Generator for CPC exports
 * Generates Z80 assembly code with image data in SCR or linear format
 */

import type { CpcModeConfig } from '@/domain/cpc'
import { generateDataSection, generatePaletteSection } from './asm-templates'
import { exportSCR } from './export-scr/export-scr'

/**
 * Generate ASM file content for SCR format
 * @param indexBuf - Color indices buffer
 * @param label - Label for the data
 * @param modeConfig - CPC mode configuration
 * @returns ASM file content as string
 */
export function generateSCRAsm(
  indexBuf: Uint8Array,
  label: string,
  modeConfig: CpcModeConfig
): string {
  const sections: string[] = []

  // Generate SCR data
  const scrData = exportSCR(indexBuf, modeConfig)
  sections.push(generateDataSection(scrData, label))

  return sections.join('\n')
}

/**
 * Generate ASM file content for Linear format
 * @param indexBuf - Color indices buffer
 * @param label - Label for the data
 * @param modeConfig - CPC mode configuration
 * @returns ASM file content as string
 */
export function generateLinearAsm(
  indexBuf: Uint8Array,
  label: string,
  modeConfig: CpcModeConfig
): string {
  const sections: string[] = []

  // Generate linear data
  const { mode, width, height } = modeConfig
  const pixelsPerByte = [2, 4, 8][mode]
  const bytesPerLine = width / pixelsPerByte
  const totalBytes = bytesPerLine * height

  const linear = new Uint8Array(totalBytes)
  let offset = 0

  // Import encodeByte locally to avoid circular deps
  const { encodeByte } = require('./encode-byte')

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < bytesPerLine; x++) {
      const px = x * pixelsPerByte
      const byte = encodeByte(indexBuf, px, y, mode, width)
      linear[offset++] = byte
    }
  }

  sections.push(generateDataSection(linear, label))

  return sections.join('\n')
}

/**
 * Generate ASM file content for palette
 * @param palette - CPC firmware palette indices
 * @param label - Label for the palette
 * @returns ASM file content as string
 */
export function generatePaletteAsm(palette: number[], label: string): string {
  return generatePaletteSection(palette.slice(0, 16), label)
}
