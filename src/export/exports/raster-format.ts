/**
 * Raster Export Format Utilities
 *
 * Export raster data for CPC Classic and CPC Plus.
 *
 * Format for each line with raster changes:
 * - CPC Classic: DB ink, hardware_color (2 bytes per change)
 * - CPC Plus: DB ink, DW cpc_plus_color (3 bytes per change, little-endian)
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterRange } from '@/libs/pixsaur-raster/types'
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
 * Expanded raster line data for a single line
 */
export interface RasterLineEntry {
  line: number
  inkIndex: number
  color: Vector<'RGB'>
}

/**
 * Expand raster ranges into per-line entries
 * Each range is expanded to individual lines
 */
export function expandRasterRanges(ranges: RasterRange[]): RasterLineEntry[] {
  const entries: RasterLineEntry[] = []

  for (const range of ranges) {
    for (let line = range.startLine; line <= range.endLine; line++) {
      entries.push({
        line,
        inkIndex: range.inkIndex,
        color: range.color
      })
    }
  }

  // Sort by line number
  return entries.sort((a, b) => a.line - b.line)
}

/**
 * Group raster entries by line
 */
export function groupByLine(
  entries: RasterLineEntry[]
): Map<number, RasterLineEntry[]> {
  const grouped = new Map<number, RasterLineEntry[]>()

  for (const entry of entries) {
    const existing = grouped.get(entry.line) || []
    existing.push(entry)
    grouped.set(entry.line, existing)
  }

  return grouped
}

/**
 * Generate ASM data for CPC Classic rasters
 * Format: For each line of the image:
 *   - DB #FF, #FF if no change needed on this line
 *   - DB ink, hardware_color if raster change needed
 *
 * Note: When a raster ends, the ink keeps its modified color until
 * another raster range explicitly changes it. No automatic restore.
 *
 * @param ranges - Raster ranges to export
 * @param imageHeight - Height of the image in lines
 * @param basePalette - Base palette firmware indices (unused, kept for API compatibility)
 * @param labelName - Label name for the ASM data
 */
export function generateClassicRasterASM(
  ranges: RasterRange[],
  imageHeight: number,
  basePalette: number[],
  labelName = 'RasterData'
): string {
  const entries = expandRasterRanges(ranges)
  const grouped = groupByLine(entries)

  const lines: string[] = [`${labelName}:`]
  lines.push(`    ; Format: DB ink, color for each of the ${imageHeight} lines`)
  lines.push('    ; #FF, #FF = no change on this line')
  lines.push('    ; Color is CPC Classic hardware value (1 byte)')
  lines.push('    ; Note: ink color persists until next explicit change')

  for (let lineNum = 0; lineNum < imageHeight; lineNum++) {
    const lineEntries = grouped.get(lineNum)

    if (!lineEntries || lineEntries.length === 0) {
      // No raster on this line - ink keeps its current color
      lines.push(`    DB #FF, #FF    ; Line ${lineNum} - no change`)
    } else {
      // Use first raster entry for this line (if multiple, take the first)
      const entry = lineEntries[0]
      const [r, g, b] = entry.color
      const hwColor = rgbToClassicHardware(r, g, b)
      lines.push(
        `    DB ${entry.inkIndex}, #${hwColor.toString(16).toUpperCase().padStart(2, '0')}    ; Line ${lineNum}`
      )
    }
  }

  // Mark basePalette as intentionally unused
  void basePalette

  return lines.join('\n')
}

/**
 * Generate ASM data for CPC Plus rasters
 * Format: For each line of the image:
 *   - DB #FF, #FF, #FF if no change needed on this line
 *   - DB ink, color_low, color_high if raster change needed
 *
 * Note: When a raster ends, the ink keeps its modified color until
 * another raster range explicitly changes it. No automatic restore.
 *
 * @param ranges - Raster ranges to export
 * @param imageHeight - Height of the image in lines
 * @param basePalette - Base palette as CPC Plus 12-bit values (unused, kept for API compatibility)
 * @param labelName - Label name for the ASM data
 */
export function generatePlusRasterASM(
  ranges: RasterRange[],
  imageHeight: number,
  basePalette: number[],
  labelName = 'RasterData'
): string {
  const entries = expandRasterRanges(ranges)
  const grouped = groupByLine(entries)

  const lines: string[] = [`${labelName}:`]
  lines.push(
    `    ; Format: DB ink, DW color for each of the ${imageHeight} lines`
  )
  lines.push('    ; #FF, #FF, #FF = no change on this line')
  lines.push('    ; Color is CPC Plus 12-bit value (2 bytes, little-endian)')
  lines.push('    ; Note: ink color persists until next explicit change')

  for (let lineNum = 0; lineNum < imageHeight; lineNum++) {
    const lineEntries = grouped.get(lineNum)

    if (!lineEntries || lineEntries.length === 0) {
      // No raster on this line - ink keeps its current color
      lines.push(`    DB #FF, #FF, #FF    ; Line ${lineNum} - no change`)
    } else {
      // Use first raster entry for this line
      const entry = lineEntries[0]
      const [r, g, b] = entry.color
      const plusColor = rgbToCPCPlus(r, g, b)
      const lowByte = plusColor & 0xff
      const highByte = (plusColor >> 8) & 0xff
      lines.push(
        `    DB ${entry.inkIndex}, #${lowByte.toString(16).toUpperCase().padStart(2, '0')}, #${highByte.toString(16).toUpperCase().padStart(2, '0')}    ; Line ${lineNum} = #${plusColor.toString(16).toUpperCase().padStart(3, '0')}`
      )
    }
  }

  // Mark basePalette as intentionally unused
  void basePalette

  return lines.join('\n')
}
