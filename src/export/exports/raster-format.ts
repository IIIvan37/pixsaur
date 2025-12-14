/**
 * Raster Export Format Utilities
 *
 * Export raster data for CPC Classic and CPC Plus.
 *
 * Format:
 * - CPC Classic: DB #00 (no change) or DB ink, hardware_color (2 bytes)
 * - CPC Plus Mode 1: DB #00 (no change) or DW color0, color1, color2, color3 (8 bytes for 4 inks)
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
 *   - DB #00 if no change needed on this line
 *   - DB count, ink0, color0, ink1, color1, ... (count pairs of ink+color)
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
  lines.push('    ; DB #00 = no change on this line')
  lines.push(
    '    ; DB count, ink0, color0, [ink1, color1, ...] = count pairs of (ink, color)'
  )
  lines.push('    ; Colors are CPC Classic hardware values')

  for (let lineNum = 0; lineNum < imageHeight; lineNum++) {
    const lineChanges = grouped.get(lineNum)

    if (!lineChanges || lineChanges.length === 0) {
      // No change on this line
      lines.push(`    DB #00    ; Line ${lineNum} - no change`)
    } else {
      // Export count + pairs of (ink, color)
      const pairs: string[] = []
      for (const change of lineChanges) {
        const [r, g, b] = change.color
        const hwColor = rgbToClassicHardware(r, g, b)
        pairs.push(
          `${change.inkIndex}, #${hwColor.toString(16).toUpperCase().padStart(2, '0')}`
        )
      }
      lines.push(
        `    DB ${lineChanges.length}, ${pairs.join(', ')}    ; Line ${lineNum}`
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
 *   - DW color0, color1, ..., color(N-1) where N = numRasterSlots
 *
 * This format exports ALL raster slot colors in ORDER (0 to N-1) for EVERY line.
 * If no change on a line, the previous line's colors are repeated.
 *
 * @param changes - Raster changes to export
 * @param imageHeight - Height of the image in lines
 * @param basePalette - Base palette as CPC Plus 12-bit values for each ink
 * @param labelName - Label name for the ASM data
 * @param numRasterSlots - Number of raster slots (inks 0 to N-1), default 4
 */
export function generatePlusRasterASM(
  changes: RasterChange[],
  imageHeight: number,
  basePalette: number[],
  labelName = 'RasterData',
  numRasterSlots = 4
): string {
  const grouped = groupChangesByLine(changes)

  // Track current palette state for each raster slot (inks 0 to N-1)
  // Initialize with base palette values
  const currentPalette = basePalette.slice(0, numRasterSlots)

  const lines: string[] = [`${labelName}:`]
  lines.push(
    `    ; CPC Plus Raster Data (${imageHeight} lines, ${numRasterSlots} raster slots)`
  )
  lines.push(
    `    ; Each line: DW color0, color1, ..., color${numRasterSlots - 1}`
  )
  lines.push('    ; Colors are 12-bit CPC Plus format (0GRB)')

  for (let lineNum = 0; lineNum < imageHeight; lineNum++) {
    const lineChanges = grouped.get(lineNum)

    // Apply any changes to current palette state
    if (lineChanges && lineChanges.length > 0) {
      for (const change of lineChanges) {
        if (change.inkIndex < numRasterSlots) {
          const [r, g, b] = change.color
          currentPalette[change.inkIndex] = rgbToCPCPlus(r, g, b)
        }
      }
    }

    // Export all raster slot colors in order (0 to N-1)
    const colorValues = currentPalette.map(
      (color) => `#${color.toString(16).toUpperCase().padStart(3, '0')}`
    )
    lines.push(`    DW ${colorValues.join(', ')}    ; Line ${lineNum}`)
  }

  return lines.join('\n')
}
