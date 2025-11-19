/**
 * CPC Classic Color Format Utilities
 *
 * CPC Classic uses firmware indices (0-26) mapped to hardware values.
 * SCR Format - Available space in first 2KB block (offsets 2000-2047):
 * - 2000: Border color (firmware index)
 * - 2001-2016: 16 palette colors (firmware indices)
 * - 2017: Border color (hardware value)
 * - 2018-2033: 16 palette colors (hardware values)
 * - 2034: Graphics mode (0, 1, or 2)
 * - 2035: Hardware type (0=Classic, 1=Plus)
 * - 2036-2047: Reserved/unused
 */

// CPC Classic firmware to hardware color mapping
export const firmwareToHardware = [
  0x54, //  0 Black
  0x44, //  1 Blue
  0x55, //  2 Bright Blue
  0x5c, //  3 Red
  0x58, //  4 Magenta
  0x5d, //  5 Mauve
  0x4c, //  6 Bright Red
  0x45, //  7 Purple
  0x4d, //  8 Bright Magenta
  0x56, //  9 Green
  0x46, // 10 Cyan
  0x57, // 11 Sky Blue
  0x5e, // 12 Yellow
  0x40, // 13 White
  0x5f, // 14 Pastel Blue
  0x4e, // 15 Orange
  0x47, // 16 Pink
  0x4f, // 17 Pastel Magenta
  0x52, // 18 Bright Green
  0x42, // 19 Sea Green
  0x53, // 20 Bright Cyan
  0x5a, // 21 Lime
  0x59, // 22 Pastel Green
  0x5b, // 23 Pastel Cyan
  0x4a, // 24 Bright Yellow
  0x43, // 25 Pastel Yellow
  0x4b // 26 Bright White
]

/**
 * Injects CPC Classic palette data into an SCR buffer
 *
 * SCR Format - Available space in first 2KB block (offsets 2000-2047):
 * - 2000: Border color (firmware index)
 * - 2001-2016: 16 palette colors (firmware indices)
 * - 2017: Border color (hardware value)
 * - 2018-2033: 16 palette colors (hardware values)
 * - 2034: Graphics mode (0, 1, or 2)
 * - 2035: Hardware type (0=Classic, 1=Plus)
 * - 2036-2047: Reserved/unused
 */
export function injectPaletteDataIntoSCR(
  scr: Uint8Array,
  palette: number[],
  mode: 0 | 1 | 2
): void {
  if (scr.length < 2048) {
    throw new Error('SCR buffer must be at least 2048 bytes')
  }

  if (palette.length < 1) {
    throw new Error('CPC Classic requires at least 1 color')
  }

  const borderIndex = palette[0] // index firmware
  const borderHw = firmwareToHardware[borderIndex]

  // Offset 2000: border firmware
  scr[2000] = borderIndex

  // Offset 2001-2016: 16 palette firmware colors (use min of palette length and 16)
  for (let i = 0; i < Math.min(16, palette.length); i++) {
    const fw = palette[i]
    scr[2001 + i] = fw
  }

  // Offset 2017: border hardware
  scr[2017] = borderHw

  // Offset 2018-2033: 16 palette hardware colors (use min of palette length and 16)
  for (let i = 0; i < Math.min(16, palette.length); i++) {
    const fw = palette[i]
    scr[2018 + i] = firmwareToHardware[fw]
  }

  // Offset 2034: graphics mode (0, 1, or 2)
  scr[2034] = mode

  // Offset 2035: hardware type (0=Classic)
  scr[2035] = 0
}

export const getHardwarePalette = (palette: number[]) => {
  return palette.map((index) => firmwareToHardware[index])
}
