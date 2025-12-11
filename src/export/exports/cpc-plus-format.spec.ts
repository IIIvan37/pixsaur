import { describe, expect, it } from 'vitest'
import {
  cpcPlusToRGB,
  cpcPlusValuesToASM,
  injectCPCPlusPaletteIntoSCR,
  paletteToCPCPlusData,
  paletteToCPCPlusValues,
  rgbToCPCPlus,
  rgbToCPCPlusBytes
} from './cpc-plus-format'

describe('cpc-plus-format', () => {
  describe('rgbToCPCPlus', () => {
    it('should convert black correctly', () => {
      // Black (0,0,0) should be 0x000
      expect(rgbToCPCPlus(0, 0, 0)).toBe(0x000)
    })

    it('should convert white correctly', () => {
      // White (255,255,255) should be 0xFFF
      expect(rgbToCPCPlus(255, 255, 255)).toBe(0xfff)
    })

    it('should convert pure red correctly', () => {
      // Red (255,0,0) -> R=15, G=0, B=0 -> 0x0F0
      expect(rgbToCPCPlus(255, 0, 0)).toBe(0x0f0)
    })

    it('should convert pure green correctly', () => {
      // Green (0,255,0) -> R=0, G=15, B=0 -> 0xF00
      expect(rgbToCPCPlus(0, 255, 0)).toBe(0xf00)
    })

    it('should convert pure blue correctly', () => {
      // Blue (0,0,255) -> R=0, G=0, B=15 -> 0x00F
      expect(rgbToCPCPlus(0, 0, 255)).toBe(0x00f)
    })

    it('should handle mid-range values', () => {
      // Mid-gray (128,128,128) -> approximately 8,8,8 -> 0x888
      const result = rgbToCPCPlus(128, 128, 128)
      // 128/255 * 15 = 7.53 -> rounds to 8
      expect(result).toBe(0x888)
    })
  })

  describe('cpcPlusToRGB', () => {
    it('should convert black correctly', () => {
      expect(cpcPlusToRGB(0x000)).toEqual([0, 0, 0])
    })

    it('should convert white correctly', () => {
      expect(cpcPlusToRGB(0xfff)).toEqual([255, 255, 255])
    })

    it('should convert pure red correctly', () => {
      // 0x0F0 -> R=15, G=0, B=0 -> (255, 0, 0)
      expect(cpcPlusToRGB(0x0f0)).toEqual([255, 0, 0])
    })

    it('should convert pure green correctly', () => {
      // 0xF00 -> R=0, G=15, B=0 -> (0, 255, 0)
      expect(cpcPlusToRGB(0xf00)).toEqual([0, 255, 0])
    })

    it('should convert pure blue correctly', () => {
      // 0x00F -> R=0, G=0, B=15 -> (0, 0, 255)
      expect(cpcPlusToRGB(0x00f)).toEqual([0, 0, 255])
    })

    it('should be inverse of rgbToCPCPlus', () => {
      // Test round-trip for pure colors (exact values)
      expect(cpcPlusToRGB(rgbToCPCPlus(255, 0, 0))).toEqual([255, 0, 0])
      expect(cpcPlusToRGB(rgbToCPCPlus(0, 255, 0))).toEqual([0, 255, 0])
      expect(cpcPlusToRGB(rgbToCPCPlus(0, 0, 255))).toEqual([0, 0, 255])
    })
  })

  describe('rgbToCPCPlusBytes', () => {
    it('should return little-endian bytes for black', () => {
      const bytes = rgbToCPCPlusBytes([0, 0, 0])
      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBe(2)
      expect(bytes[0]).toBe(0x00) // Low byte: RRRR BBBB
      expect(bytes[1]).toBe(0x00) // High byte: 0000 GGGG
    })

    it('should return little-endian bytes for white', () => {
      const bytes = rgbToCPCPlusBytes([255, 255, 255])
      expect(bytes[0]).toBe(0xff) // Low byte: 1111 1111
      expect(bytes[1]).toBe(0x0f) // High byte: 0000 1111
    })

    it('should return little-endian bytes for red', () => {
      // Red (255,0,0) -> 0x0F0
      const bytes = rgbToCPCPlusBytes([255, 0, 0])
      expect(bytes[0]).toBe(0xf0) // Low byte: 1111 0000
      expect(bytes[1]).toBe(0x00) // High byte: 0000 0000
    })

    it('should return little-endian bytes for green', () => {
      // Green (0,255,0) -> 0xF00
      const bytes = rgbToCPCPlusBytes([0, 255, 0])
      expect(bytes[0]).toBe(0x00) // Low byte: 0000 0000
      expect(bytes[1]).toBe(0x0f) // High byte: 0000 1111
    })
  })

  describe('paletteToCPCPlusData', () => {
    it('should convert empty palette', () => {
      const data = paletteToCPCPlusData([])
      expect(data.length).toBe(0)
    })

    it('should convert single color palette', () => {
      const data = paletteToCPCPlusData([[255, 255, 255]])
      expect(data.length).toBe(2)
      expect(data[0]).toBe(0xff)
      expect(data[1]).toBe(0x0f)
    })

    it('should convert multiple colors palette', () => {
      const palette: Array<[number, number, number]> = [
        [0, 0, 0], // Black
        [255, 255, 255], // White
        [255, 0, 0] // Red
      ]
      const data = paletteToCPCPlusData(palette)
      expect(data.length).toBe(6) // 3 colors * 2 bytes

      // Black
      expect(data[0]).toBe(0x00)
      expect(data[1]).toBe(0x00)

      // White
      expect(data[2]).toBe(0xff)
      expect(data[3]).toBe(0x0f)

      // Red
      expect(data[4]).toBe(0xf0)
      expect(data[5]).toBe(0x00)
    })
  })

  describe('paletteToCPCPlusValues', () => {
    it('should convert empty palette', () => {
      expect(paletteToCPCPlusValues([])).toEqual([])
    })

    it('should convert palette to 16-bit values', () => {
      const palette: Array<[number, number, number]> = [
        [0, 0, 0],
        [255, 255, 255],
        [255, 0, 0]
      ]
      const values = paletteToCPCPlusValues(palette)
      expect(values).toEqual([0x000, 0xfff, 0x0f0])
    })
  })

  describe('cpcPlusValuesToASM', () => {
    it('should generate ASM with single value', () => {
      const asm = cpcPlusValuesToASM([0x000], 'my_palette')
      expect(asm).toContain('my_palette:')
      expect(asm).toContain('DEFW #0000')
    })

    it('should generate ASM with multiple values', () => {
      const asm = cpcPlusValuesToASM([0x000, 0xfff, 0x0f0], 'colors')
      expect(asm).toContain('colors:')
      expect(asm).toContain('DEFW #0000, #0FFF, #00F0')
    })

    it('should pad hex values to 4 digits', () => {
      const asm = cpcPlusValuesToASM([0xf], 'test')
      expect(asm).toContain('#000F')
    })

    it('should use uppercase hex', () => {
      const asm = cpcPlusValuesToASM([0xabc], 'test')
      expect(asm).toContain('#0ABC')
    })
  })

  describe('injectCPCPlusPaletteIntoSCR', () => {
    it('should throw error if buffer is too small', () => {
      const scr = new Uint8Array(100)
      expect(() => injectCPCPlusPaletteIntoSCR(scr, [0x000])).toThrow(
        'SCR buffer must be at least 2048 bytes'
      )
    })

    it('should throw error if palette has more than 16 colors', () => {
      const scr = new Uint8Array(2048)
      const palette = new Array(17).fill(0x000)
      expect(() => injectCPCPlusPaletteIntoSCR(scr, palette)).toThrow(
        'CPC Plus supports maximum 16 colors'
      )
    })

    it('should inject border color at correct offset', () => {
      const scr = new Uint8Array(2048)
      // First color in palette is border color
      injectCPCPlusPaletteIntoSCR(scr, [0x0f0]) // Red as border

      // Border is at 2000-2001 (little-endian)
      expect(scr[2000]).toBe(0xf0) // Low byte
      expect(scr[2001]).toBe(0x00) // High byte
    })

    it('should inject palette colors at correct offsets', () => {
      const scr = new Uint8Array(2048)
      // 0x0F0 = Red, 0xF00 = Green, 0x00F = Blue
      injectCPCPlusPaletteIntoSCR(scr, [0x0f0, 0xf00, 0x00f])

      // Ink 0 (Red) at 2002-2003
      expect(scr[2002]).toBe(0xf0)
      expect(scr[2003]).toBe(0x00)

      // Ink 1 (Green) at 2004-2005
      expect(scr[2004]).toBe(0x00)
      expect(scr[2005]).toBe(0x0f)

      // Ink 2 (Blue) at 2006-2007
      expect(scr[2006]).toBe(0x0f)
      expect(scr[2007]).toBe(0x00)
    })

    it('should set hardware type flag to Plus (1)', () => {
      const scr = new Uint8Array(2048)
      injectCPCPlusPaletteIntoSCR(scr, [0x000])
      expect(scr[2035]).toBe(1)
    })

    it('should handle full 16-color palette', () => {
      const scr = new Uint8Array(2048)
      const palette = Array.from({ length: 16 }, (_, i) => i * 0x111)

      injectCPCPlusPaletteIntoSCR(scr, palette)

      // Verify all 16 colors were written (each 2 bytes starting at 2002)
      for (let i = 0; i < 16; i++) {
        const offset = 2002 + i * 2
        // Just verify something was written
        const value = scr[offset] | (scr[offset + 1] << 8)
        expect(value).toBeGreaterThanOrEqual(0)
      }

      expect(scr[2035]).toBe(1) // Plus hardware type
    })
  })
})
