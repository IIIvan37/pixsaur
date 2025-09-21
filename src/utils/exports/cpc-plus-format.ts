/**
 * CPC Plus Color Format Utilities
 * 
 * CPC Plus uses a format with 4 bits per component, stored in 2 bytes.
 * Memory layout for Z80 little-endian:
 * - 1st byte (even address): RRRR BBBB
 * - 2nd byte (odd address):  0000 GGGG
 * 
 * Which gives us the 16-bit value: 0000 GGGG RRRR BBBB
 */

/**
 * Converts RGB values to CPC Plus 16-bit format.
 * Format: 0000 GGGG RRRR BBBB (bits 15-12 unused, G=11-8, R=7-4, B=3-0)
 * Each color component uses 4 bits (0-15 range)
 */
export function rgbToCPCPlus(r: number, g: number, b: number): number {
  // Convert 8-bit RGB to 4-bit RGB
  const r4 = Math.round((r / 255) * 15)
  const g4 = Math.round((g / 255) * 15)
  const b4 = Math.round((b / 255) * 15)
  
  // Pack into format: 0000 GGGG RRRR BBBB
  return (g4 << 8) | (r4 << 4) | b4
}

/**
 * Converts CPC Plus 16-bit format back to RGB values.
 * Format: 0000 GGGG RRRR BBBB
 */
export function cpcPlusToRGB(cpcValue: number): [number, number, number] {
  // Extract 4-bit components from format: 0000 GGGG RRRR BBBB
  const g4 = (cpcValue >> 8) & 0xF
  const r4 = (cpcValue >> 4) & 0xF
  const b4 = cpcValue & 0xF
  
  // Convert 4-bit back to 8-bit
  const r = Math.round((r4 / 15) * 255)
  const g = Math.round((g4 / 15) * 255)
  const b = Math.round((b4 / 15) * 255)
  
  return [r, g, b]
}

/**
 * Converts RGB to CPC Plus format as Z80 little-endian bytes.
 * Returns [low_byte, high_byte] where the 16-bit value is stored as little-endian.
 * Format: 0000 GGGG RRRR BBBB
 */
export function rgbToCPCPlusBytes(rgb: [number, number, number]): Uint8Array {
  const cpcValue = rgbToCPCPlus(rgb[0], rgb[1], rgb[2])
  
  // Z80 little-endian: low byte first, high byte second
  return new Uint8Array([
    cpcValue & 0xFF,        // Low byte: RRRR BBBB
    (cpcValue >> 8) & 0xFF  // High byte: 0000 GGGG
  ])
}

/**
 * Converts a palette to CPC Plus format as raw bytes for injection into SCR.
 * @param palette Array of RGB tuples
 * @returns Uint8Array with Z80 little-endian CPC Plus values
 */
export function paletteToCPCPlusData(palette: Array<[number, number, number]>): Uint8Array {
  const totalBytes = palette.length * 2 // 2 bytes per color
  const result = new Uint8Array(totalBytes)
  
  for (let i = 0; i < palette.length; i++) {
    const bytes = rgbToCPCPlusBytes(palette[i])
    result[i * 2] = bytes[0]     // Low byte
    result[i * 2 + 1] = bytes[1] // High byte
  }
  
  return result
}

/**
 * Converts a palette to CPC Plus 16-bit values.
 * @param palette Array of RGB tuples
 * @returns Array of 16-bit CPC Plus values
 */
export function paletteToCPCPlusValues(palette: Array<[number, number, number]>): number[] {
  return palette.map(([r, g, b]) => rgbToCPCPlus(r, g, b))
}

/**
 * Converts CPC Plus values to assembly format using # notation.
 * @param cpcValues Array of 16-bit CPC Plus values
 * @param labelName Label name for the assembly data
 * @returns Assembly string with DEFW directive
 */
export function cpcPlusValuesToASM(cpcValues: number[], labelName: string): string {
  const hexValues = cpcValues.map(value => `#${value.toString(16).toUpperCase().padStart(4, '0')}`)
  return `${labelName}:\n    DEFW ${hexValues.join(', ')}\n`
}

/**
 * Injects CPC Plus palette data into an SCR buffer.
 * Updates the palette area with CPC Plus format colors and sets the CPC Plus marker.
 * 
 * SCR Memory layout:
 * - 0x0000-0x0F9F: Graphics data (4000 bytes)
 * - 0x0FA0-0x0FC7: Palette data (40 bytes = 20 colors × 2 bytes)
 * - 0x0FC8-0x0FFF: Unused space (can contain CPC Plus marker)
 * 
 * @param scr SCR buffer (must be at least 2048 bytes)
 * @param cpcPalette Array of 16-bit CPC Plus values (max 16 colors)
 */
export function injectCPCPlusPaletteIntoSCR(scr: Uint8Array, cpcPalette: number[]): void {
  if (scr.length < 2048) {
    throw new Error('SCR buffer must be at least 2048 bytes')
  }
  
  if (cpcPalette.length > 16) {
    throw new Error('CPC Plus supports maximum 16 colors')
  }
  
  // Border color (first color in palette)
  const borderBytes = rgbToCPCPlusBytes(cpcPlusToRGB(cpcPalette[0]))
  scr[2000] = borderBytes[0] // Low byte
  scr[2001] = borderBytes[1] // High byte
  
  // Inject palette data starting at offset 2002
  for (let i = 0; i < cpcPalette.length; i++) {
    const bytes = rgbToCPCPlusBytes(cpcPlusToRGB(cpcPalette[i]))
    scr[2002 + i * 2] = bytes[0]     // Low byte
    scr[2002 + i * 2 + 1] = bytes[1] // High byte
  }
  
  // Set CPC Plus marker at offset 2034 ('C+')
  scr[2034] = 0xC9 // 'C'
  scr[2035] = 0x2B // '+'
}