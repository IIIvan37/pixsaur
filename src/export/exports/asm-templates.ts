/**
 * ASM code templates for CPC exports
 * MVP Version: Simple data export without compression
 *
 * Phase 1: SCR and Linear format support
 * Phase 2 (Future): Compression routines (ZX0, ZX1)
 */

import type { DataFormat } from './types'

/**
 * Generate ASM header comment
 */
export function generateASMComment(
  filename: string,
  format: DataFormat
): string {
  const formatDesc =
    format === 'scr'
      ? 'CPC Screen Format (16Ko, entrelaced)'
      : 'Linear Format (sequential bytes)'

  return `; Pixsaur Export - ${filename}
; Format: ${formatDesc}
; Generated: ${new Date().toISOString()}
`
}

/**
 * Generate data section with DB directives
 * @param data - Binary data to export
 * @param label - Label name for the data
 * @param bytesPerLine - Number of bytes per line (default: 16)
 */
export function generateDataSection(
  data: Uint8Array,
  label: string,
  bytesPerLine = 16
): string {
  const lines: string[] = []

  if (label) {
    lines.push(`${label}:`)
  }

  for (let i = 0; i < data.length; i += bytesPerLine) {
    const slice = data.slice(i, i + bytesPerLine)
    const bytes = Array.from(slice)
      .map((b) => `#${b.toString(16).padStart(2, '0').toUpperCase()}`)
      .join(',')
    lines.push(`    DB      ${bytes}`)
  }

  return lines.join('\n')
}

/**
 * Generate palette section
 * @param palette - Array of CPC firmware palette indices (0-26)
 * @param label - Label name for palette data
 */
export function generatePaletteSection(
  palette: number[],
  label: string
): string {
  if (!label) {
    label = 'Palette'
  }

  const bytes = palette
    .slice(0, 16) // CPC has 16 color slots
    .map((idx) => `#${idx.toString(16).padStart(2, '0').toUpperCase()}`)
    .join(',')

  return `${label}:
    DB      ${bytes}`
}
