/**
 * CPC /**
 * Converts RGB to C/**
 * Converts RGB values to CPC Plus format as Z80 little-endian bytes.
 * Returns [low_byte, high_byte] where the 16-bit vaC Plue is stored as little-endian.
 16-bit format.
 * Format: 0000 GGGG RRRR BBBB (bits 15-12 unused, G=11-8, R=7-4, B=3-0)
 * Each color component uses 4 bits (0-15 range)
 */
export function rgbToCP* FPrmat: 0000 GGGG RRRR BBBB
 */lus(r: number, g: number, b: number): number {or Format Utilities
 * 
 * CPC Plus uses a format with 4 bits per component, stored in 2 bytes.
 * Memory layout for Z80 little-endian:
 * - 1st byte (even address): BBBB GGGG
 * - 2nd byte (odd address):  0000 RRRR
 * 
 * Which gives us the 16-bit value: 0000 RRRR BBBB GGGG
 */

/**
 * Convert RGB values (0-255) to CPC Plus format for Z80 little-endian
 * @param r Red component (0-255)
 * @param g Green component (0-255) 
 * @param b Blue component (0-255)
 * @returns 16-bit value in Z80 format: 0000 RRRR BBBB GGGG
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
 * Convert CPC Plus format back to RGB values (for testing/validation)
 * @param cpcValue 16-bit CPC Plus value (0000 RRRR BBBB GGGG)
 * @returns RGB array [r, g, b] with values 0-255
 */
export function cpcPlusToRGB(cpcValue: number): [number, number, number] {
  // Extract 4-bit components from format: 0000 GGGG RRRR BBBB
  const g4 = (cpcValue >> 8) & 0xF
  const r4 = (cpcValue >> 4) & 0xF
  const b4 = cpcValue & 0xF  // Convert 4-bit back to 8-bit
  const r = Math.round((r4 / 15) * 255)
  const g = Math.round((g4 / 15) * 255)
  const b = Math.round((b4 / 15) * 255)
  
  return [r, g, b]
}

/**
 * Convert RGB color array to CPC Plus bytes (little-endian for Z80)
 * @param rgb RGB array [r, g, b]
 * @returns Uint8Array with 2 bytes: [BBBBGGGG, 0000RRRR]
 */
export function rgbToCPCPlusBytes(rgb: [number, number, number]): Uint8Array {
  const [r, g, b] = rgb
  const cpcValue = rgbToCPCPlus(r, g, b)
  
  // Store as little-endian for Z80
  // 1st byte: BBBB GGGG, 2nd byte: 0000 RRRR
  return new Uint8Array([
    cpcValue & 0xFF,        // Low byte: BBBB GGGG
    (cpcValue >> 8) & 0xFF  // High byte: 0000 RRRR
  ])
}

/**
 * Convert a palette of RGB colors to CPC Plus format
 * @param palette Array of RGB vectors
 * @returns Uint8Array with CPC Plus data (2 bytes per color)
 */
export function paletteToCPCPlusData(palette: Array<[number, number, number]>): Uint8Array {
  const cpcData = new Uint8Array(palette.length * 2)
  
  for (let i = 0; i < palette.length; i++) {
    const cpcBytes = rgbToCPCPlusBytes(palette[i])
    cpcData[i * 2] = cpcBytes[0]     // RRRR GGGG
    cpcData[i * 2 + 1] = cpcBytes[1] // 0000 BBBB
  }
  
  return cpcData
}

/**
 * Convert a palette of RGB colors to CPC Plus 16-bit values array
 * @param palette Array of RGB vectors
 * @returns Array of 16-bit CPC Plus values
 */
export function paletteToCPCPlusValues(palette: Array<[number, number, number]>): number[] {
  return palette.map(([r, g, b]) => rgbToCPCPlus(r, g, b))
}

/**
 * Convert 16-bit values to assembly data format for CPC Plus
 * @param values Array of 16-bit CPC Plus values
 * @param label Assembly label
 * @returns Assembly data string with proper 16-bit formatting
 */
export function cpcPlusValuesToASM(values: number[], label: string): string {
  const lines: string[] = []
  lines.push(`${label}:`)
  
  // Group values in lines of 8 for readability
  for (let i = 0; i < values.length; i += 8) {
    const chunk = values.slice(i, i + 8)
    const hexValues = chunk.map(val => `#${val.toString(16).toUpperCase().padStart(4, '0')}`)
    lines.push(`    DEFW ${hexValues.join(', ')}`)
  }
  
  return lines.join('\n') + '\n'
}

/**
 * Inject CPC Plus palette data into SCR file
 * @param scr SCR data buffer
 * @param cpcPlusPalette Array of 16-bit CPC Plus values (max 16 colors)
 */
export function injectCPCPlusPaletteIntoSCR(scr: Uint8Array, cpcPlusPalette: number[]) {
  // Pour CPC Plus, on injecte les valeurs 16-bit dans la zone palette du SCR
  // Format Z80 little-endian: 1er octet = RRRR GGGG, 2ème octet = 0000 BBBB
  
  // Border color (première couleur de la palette)
  const borderValue = cpcPlusPalette[0] || 0x0000
  scr[2000] = borderValue & 0xFF        // RRRR GGGG
  scr[2001] = (borderValue >> 8) & 0xFF // 0000 BBBB
  
  // Palette colors (jusqu'à 16 couleurs) - stockées à partir de l'offset 2002
  for (let i = 0; i < Math.min(16, cpcPlusPalette.length); i++) {
    const cpcValue = cpcPlusPalette[i]
    const offset = 2002 + (i * 2)
    
    scr[offset] = cpcValue & 0xFF        // RRRR GGGG
    scr[offset + 1] = (cpcValue >> 8) & 0xFF // 0000 BBBB
  }
  
  // Marquer le fichier comme CPC Plus (utiliser un offset spécial pour identifier le format)
  // On peut utiliser l'offset 2034 (après les 16 couleurs) pour un marqueur
  scr[2034] = 0xC9 // Marqueur CPC Plus ('C')
  scr[2035] = 0x2B // Marqueur CPC Plus ('+')
}

/**
 * Convert image data to CPC Plus format using color indexes (same as Classic)
 * @param imageData ImageData from canvas
 * @param palette RGB palette to use for conversion
 * @returns Uint8Array with CPC Plus data (2 bytes per pixel)
 */
export function imageDataToCPCPlusBuffer(
  imageData: ImageData, 
  palette: Array<[number, number, number]>
): Uint8Array {
  const { data, width, height } = imageData
  const cpcBuffer = new Uint8Array(width * height * 2) // 2 bytes per pixel
  
  for (let i = 0; i < width * height; i++) {
    const pixelOffset = i * 4
    const r = data[pixelOffset]
    const g = data[pixelOffset + 1] 
    const b = data[pixelOffset + 2]
    
    // Find closest color in palette
    let minDistance = Infinity
    let closestColor = palette[0]
    
    for (const paletteColor of palette) {
      const [pr, pg, pb] = paletteColor
      const distance = Math.sqrt(
        (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
      )
      if (distance < minDistance) {
        minDistance = distance
        closestColor = paletteColor
      }
    }
    
    // Convert to CPC Plus and store
    const cpcBytes = rgbToCPCPlusBytes(closestColor)
    const bufferOffset = i * 2
    cpcBuffer[bufferOffset] = cpcBytes[0]     // RRRR GGGG
    cpcBuffer[bufferOffset + 1] = cpcBytes[1] // 0000 BBBB
  }
  
  return cpcBuffer
}

/**
 * Convert image data to CPC Plus 16-bit values array
 * @param imageData ImageData from canvas
 * @param palette RGB palette to use for conversion
 * @returns Array of 16-bit CPC Plus values
 */
export function imageDataToCPCPlusValues(
  imageData: ImageData, 
  palette: Array<[number, number, number]>
): number[] {
  const { data, width, height } = imageData
  const cpcValues: number[] = []
  
  for (let i = 0; i < width * height; i++) {
    const pixelOffset = i * 4
    const r = data[pixelOffset]
    const g = data[pixelOffset + 1] 
    const b = data[pixelOffset + 2]
    
    // Find closest color in palette
    let minDistance = Infinity
    let closestColor = palette[0]
    
    for (const paletteColor of palette) {
      const [pr, pg, pb] = paletteColor
      const distance = Math.sqrt(
        (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
      )
      if (distance < minDistance) {
        minDistance = distance
        closestColor = paletteColor
      }
    }
    
    // Convert to CPC Plus 16-bit value
    cpcValues.push(rgbToCPCPlus(closestColor[0], closestColor[1], closestColor[2]))
  }
  
  return cpcValues
}