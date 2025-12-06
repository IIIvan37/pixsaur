/**
 * Raster Export Format Utilities
 *
 * Export raster data for CPC Classic and CPC Plus.
 *
 * Format:
 * - CPC Classic: DB #FF (no change) or DB ink, hardware_color (2 bytes)
 * - CPC Plus Mode 1: DB #FF (no change) or DW color0, color1, color2, color3 (8 bytes for 4 inks)
 */

import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { cpcFullPalette } from '@/palettes/cpc-palette'
import { firmwareToHardware } from './cpc-format'
import { rgbToCPCPlus } from './cpc-plus-format'

/**
 * Find the closest CPC Classic color (firmware index) for an RGB value
 */
export function rgbToFirmwareIndex(r: number, g: number, b: number): number {
  let bestIndex = 0
  let bestDistance = Number.MAX_VALUE

  for (let i = 0; i < cpcFullPalette.length; i++) {
    const [pr, pg, pb] = cpcFullPalette[i].vector
    const distance = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Convert RGB to CPC Classic hardware color value
 */
export function rgbToClassicHardware(r: number, g: number, b: number): number {
  const firmwareIndex = rgbToFirmwareIndex(r, g, b)
  return firmwareToHardware[firmwareIndex]
}

/**
 * Group raster changes by line
 */
export function groupChangesByLine(
  changes: RasterChange[]
): Map<number, RasterChange[]> {
  const grouped = new Map<number, RasterChange[]>()

  for (const change of changes) {
    const existing = grouped.get(change.line) || []
    existing.push(change)
    grouped.set(change.line, existing)
  }

  return grouped
}

/**
 * Generate ASM data for CPC Classic rasters
 * Format: For each line of the image:
 *   - DB #FF if no change needed on this line
 *   - DB ink, hardware_color if raster change needed
 *
 * Ink color persists until next explicit change.
 *
 * @param changes - Raster changes to export
 * @param imageHeight - Height of the image in lines
 * @param basePalette - Base palette firmware indices (unused, kept for API compatibility)
 * @param labelName - Label name for the ASM data
 */
export function generateClassicRasterASM(
  changes: RasterChange[],
  imageHeight: number,
  basePalette: number[],
  labelName = 'RasterData'
): string {
  const grouped = groupChangesByLine(changes)

  const lines: string[] = [`${labelName}:`]
  lines.push(`    ; Format: For each of the ${imageHeight} lines:`)
  lines.push('    ; DB #FF = no change on this line')
  lines.push(
    '    ; DB ink, color = change ink to color (CPC Classic hardware value)'
  )
  lines.push('    ; Note: ink color persists until next explicit change')

  for (let lineNum = 0; lineNum < imageHeight; lineNum++) {
    const lineChanges = grouped.get(lineNum)

    if (!lineChanges || lineChanges.length === 0) {
      // No change on this line
      lines.push(`    DB #FF    ; Line ${lineNum} - no change`)
    } else {
      // Use first change for this line (if multiple, take the first)
      const change = lineChanges[0]
      const [r, g, b] = change.color
      const hwColor = rgbToClassicHardware(r, g, b)
      lines.push(
        `    DB ${change.inkIndex}, #${hwColor.toString(16).toUpperCase().padStart(2, '0')}    ; Line ${lineNum}`
      )
    }
  }

  // Mark basePalette as intentionally unused
  void basePalette

  return lines.join('\n')
}

/**
 * Generate ASM data for CPC Plus rasters (Mode 1 only)
 * Format: For each line of the image:
 *   - DB #FF if no change needed on this line
 *   - DW color0, color1, color2, color3 if any ink changes (8 bytes, little-endian)
 *
 * In Mode 1, we have 4 inks and can change all 4 per line.
 * Colors not explicitly changed use basePalette values.
 *
 * @param changes - Raster changes to export
 * @param imageHeight - Height of the image in lines
 * @param basePalette - Base palette as CPC Plus 12-bit values
 * @param labelName - Label name for the ASM data
 */
export function generatePlusRasterASM(
  changes: RasterChange[],
  imageHeight: number,
  basePalette: number[],
  labelName = 'RasterData'
): string {
  const grouped = groupChangesByLine(changes)

  const lines: string[] = [`${labelName}:`]
  lines.push(`    ; CPC Plus Mode 1 Raster Data (${imageHeight} lines)`)
  lines.push('    ; DB #FF = no change on this line')
  lines.push(
    '    ; DW ink0, ink1, ink2, ink3 = set all 4 inks (12-bit colors, little-endian)'
  )

  // Track current palette state (starts with base palette)
  const currentPalette = [...basePalette.slice(0, 4)]
  // Ensure we have 4 entries
  while (currentPalette.length < 4) {
    currentPalette.push(0)
  }

  for (let lineNum = 0; lineNum < imageHeight; lineNum++) {
    const lineChanges = grouped.get(lineNum)

    if (!lineChanges || lineChanges.length === 0) {
      // No change on this line
      lines.push(`    DB #FF    ; Line ${lineNum} - no change`)
    } else {
      // Apply changes to current palette
      for (const change of lineChanges) {
        if (change.inkIndex >= 0 && change.inkIndex < 4) {
          const [r, g, b] = change.color
          currentPalette[change.inkIndex] = rgbToCPCPlus(r, g, b)
        }
      }

      // Output all 4 colors as 12-bit values
      lines.push(
        `    DW #${currentPalette[0].toString(16).toUpperCase().padStart(3, '0')}, #${currentPalette[1].toString(16).toUpperCase().padStart(3, '0')}, #${currentPalette[2].toString(16).toUpperCase().padStart(3, '0')}, #${currentPalette[3].toString(16).toUpperCase().padStart(3, '0')}    ; Line ${lineNum}`
      )
    }
  }

  return lines.join('\n')
}
