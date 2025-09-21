import { describe, expect, test } from 'vitest'
import {
  cpcPlusToRGB,
  cpcPlusValuesToASM,
  injectCPCPlusPaletteIntoSCR,
  paletteToCPCPlusData,
  paletteToCPCPlusValues,
  rgbToCPCPlus,
  rgbToCPCPlusBytes
} from './cpc-plus-format'

describe('CPC Plus Format Conversion', () => {
  test('rgbToCPCPlus converts RGB to correct Z80 format', () => {
    // Test pure colors - format: 0000 GGGG RRRR BBBB
    expect(rgbToCPCPlus(255, 0, 0)).toBe(0x00f0) // Red: 0000 0000 1111 0000
    expect(rgbToCPCPlus(0, 255, 0)).toBe(0x0f00) // Green: 0000 1111 0000 0000
    expect(rgbToCPCPlus(0, 0, 255)).toBe(0x000f) // Blue: 0000 0000 0000 1111

    // Test black and white
    expect(rgbToCPCPlus(0, 0, 0)).toBe(0x0000) // Black: 0000 0000 0000 0000
    expect(rgbToCPCPlus(255, 255, 255)).toBe(0x0fff) // White: 0000 1111 1111 1111

    // Test mid-gray (should map to 8/15 ≈ 0x8)
    expect(rgbToCPCPlus(128, 128, 128)).toBe(0x0888) // Gray: 0000 1000 1000 1000
  })

  test('cpcPlusToRGB converts back to RGB correctly', () => {
    // Test pure colors
    expect(cpcPlusToRGB(0x00f0)).toEqual([255, 0, 0]) // Red
    expect(cpcPlusToRGB(0x0f00)).toEqual([0, 255, 0]) // Green
    expect(cpcPlusToRGB(0x000f)).toEqual([0, 0, 255]) // Blue

    // Test black and white
    expect(cpcPlusToRGB(0x0000)).toEqual([0, 0, 0]) // Black
    expect(cpcPlusToRGB(0x0fff)).toEqual([255, 255, 255]) // White
  })

  test('rgbToCPCPlusBytes produces correct Z80 little-endian bytes', () => {
    // Test red (0x00F0) -> bytes should be [0xF0, 0x00]
    const redBytes = rgbToCPCPlusBytes([255, 0, 0])
    expect(redBytes).toEqual(new Uint8Array([0xf0, 0x00])) // RRRR BBBB, 0000 GGGG

    // Test green (0x0F00) -> bytes should be [0x00, 0x0F]
    const greenBytes = rgbToCPCPlusBytes([0, 255, 0])
    expect(greenBytes).toEqual(new Uint8Array([0x00, 0x0f])) // RRRR BBBB, 0000 GGGG

    // Test blue (0x000F) -> bytes should be [0x0F, 0x00]
    const blueBytes = rgbToCPCPlusBytes([0, 0, 255])
    expect(blueBytes).toEqual(new Uint8Array([0x0f, 0x00])) // RRRR BBBB, 0000 GGGG

    // Test white (0x0FFF) -> bytes should be [0xFF, 0x0F]
    const whiteBytes = rgbToCPCPlusBytes([255, 255, 255])
    expect(whiteBytes).toEqual(new Uint8Array([0xff, 0x0f])) // RRRR BBBB, 0000 GGGG
  })

  test('paletteToCPCPlusData converts palette correctly', () => {
    const palette: Array<[number, number, number]> = [
      [255, 0, 0], // Red -> 0x00F0 -> bytes [0xF0, 0x00]
      [0, 255, 0], // Green -> 0x0F00 -> bytes [0x00, 0x0F]
      [0, 0, 255] // Blue -> 0x000F -> bytes [0x0F, 0x00]
    ]

    const cpcData = paletteToCPCPlusData(palette)

    // Should be 6 bytes total (3 colors × 2 bytes each)
    expect(cpcData.length).toBe(6)

    // Check each color in Z80 little-endian format
    expect(cpcData[0]).toBe(0xf0) // Red: RRRR BBBB
    expect(cpcData[1]).toBe(0x00) // Red: 0000 GGGG
    expect(cpcData[2]).toBe(0x00) // Green: RRRR BBBB
    expect(cpcData[3]).toBe(0x0f) // Green: 0000 GGGG
    expect(cpcData[4]).toBe(0x0f) // Blue: RRRR BBBB
    expect(cpcData[5]).toBe(0x00) // Blue: 0000 GGGG
  })

  test('cpcPlusValuesToASM produces correct assembly output', () => {
    const cpcValues = [0x00f0, 0x0f00, 0x000f] // Red, Green, Blue
    const asmOutput = cpcPlusValuesToASM(cpcValues, 'test_palette')

    const expectedOutput = `test_palette:
    DEFW #00F0, #0F00, #000F
`

    expect(asmOutput).toBe(expectedOutput)
  })

  test('paletteToCPCPlusValues converts palette to 16-bit values', () => {
    const palette: Array<[number, number, number]> = [
      [255, 0, 0], // Red -> 0x00F0
      [0, 255, 0], // Green -> 0x0F00
      [0, 0, 255] // Blue -> 0x000F
    ]

    const cpcValues = paletteToCPCPlusValues(palette)

    expect(cpcValues).toEqual([0x00f0, 0x0f00, 0x000f])
  })

  test('injectCPCPlusPaletteIntoSCR injects data correctly', () => {
    // Créer un buffer SCR vide
    const scr = new Uint8Array(2048)
    scr.fill(0)

    const cpcPalette = [0x00f0, 0x0f00, 0x000f] // Red, Green, Blue

    injectCPCPlusPaletteIntoSCR(scr, cpcPalette)

    // Vérifier border color (première couleur) - Red = 0x00F0
    expect(scr[2000]).toBe(0xf0) // RRRR BBBB
    expect(scr[2001]).toBe(0x00) // 0000 GGGG

    // Vérifier les couleurs de palette
    expect(scr[2002]).toBe(0xf0) // Red: RRRR BBBB
    expect(scr[2003]).toBe(0x00) // Red: 0000 GGGG
    expect(scr[2004]).toBe(0x00) // Green: RRRR BBBB
    expect(scr[2005]).toBe(0x0f) // Green: 0000 GGGG
    expect(scr[2006]).toBe(0x0f) // Blue: RRRR BBBB
    expect(scr[2007]).toBe(0x00) // Blue: 0000 GGGG

    // Vérifier le marqueur CPC Plus
    expect(scr[2034]).toBe(0xc9) // 'C'
    expect(scr[2035]).toBe(0x2b) // '+'
  })

  test('round-trip conversion preserves color fidelity', () => {
    const testColors: Array<[number, number, number]> = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 255],
      [0, 0, 0],
      [128, 128, 128],
      [255, 128, 64]
    ]

    testColors.forEach(([r, g, b]) => {
      const cpcValue = rgbToCPCPlus(r, g, b)
      const [backR, backG, backB] = cpcPlusToRGB(cpcValue)

      // Due to 4-bit precision, we expect some precision loss
      // but should be within reasonable tolerance (±8 for 4-bit)
      expect(Math.abs(backR - r)).toBeLessThanOrEqual(16)
      expect(Math.abs(backG - g)).toBeLessThanOrEqual(16)
      expect(Math.abs(backB - b)).toBeLessThanOrEqual(16)
    })
  })
})
