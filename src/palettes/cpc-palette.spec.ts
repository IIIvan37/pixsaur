import { describe, it, expect } from 'vitest'
import {
  generateAmstradCPCPalette,
  vectorToHex,
  injectPaletteDataIntoSCR,
  getHardwarePalette,
  generateCPCPlusPalette,
  getPaletteForHardware,
  cpcPalette
} from './cpc-palette'
import { CPCHardware } from '@/libs/types'

describe('CPC Palette', () => {
  describe('generateAmstradCPCPalette', () => {
    it('should return 27 colors', () => {
      const palette = generateAmstradCPCPalette()
      expect(palette).toHaveLength(27)
    })

    it('should return valid RGB vectors', () => {
      const palette = generateAmstradCPCPalette()
      for (const color of palette) {
        expect(color).toHaveLength(3)
        expect(color[0]).toBeGreaterThanOrEqual(0)
        expect(color[0]).toBeLessThanOrEqual(255)
        expect(color[1]).toBeGreaterThanOrEqual(0)
        expect(color[1]).toBeLessThanOrEqual(255)
        expect(color[2]).toBeGreaterThanOrEqual(0)
        expect(color[2]).toBeLessThanOrEqual(255)
      }
    })
  })

  describe('vectorToHex', () => {
    it('should convert RGB vector to hex string', () => {
      expect(vectorToHex([255, 0, 0])).toBe('ff0000')
      expect(vectorToHex([0, 255, 0])).toBe('00ff00')
      expect(vectorToHex([0, 0, 255])).toBe('0000ff')
      expect(vectorToHex([128, 128, 128])).toBe('808080')
    })

    it('should pad single digit values with zero', () => {
      expect(vectorToHex([1, 2, 3])).toBe('010203')
      expect(vectorToHex([15, 16, 17])).toBe('0f1011')
    })
  })

  describe('injectPaletteDataIntoSCR', () => {
    it('should inject palette data into SCR buffer', () => {
      const scr = new Uint8Array(2048)
      const palette = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

      injectPaletteDataIntoSCR(scr, palette)

      // Check border color
      expect(scr[2000]).toBe(0) // border index
      expect(scr[2001 + 16]).toBe(0x54) // border hardware value

      // Check first few palette entries
      expect(scr[2001]).toBe(0) // firmware index
      expect(scr[2018]).toBe(0x54) // hardware value for index 0

      expect(scr[2002]).toBe(1) // firmware index
      expect(scr[2019]).toBe(0x44) // hardware value for index 1
    })
  })

  describe('getHardwarePalette', () => {
    it('should convert firmware indices to hardware values', () => {
      const firmwarePalette = [0, 1, 2, 13, 26]
      const hardwarePalette = getHardwarePalette(firmwarePalette)

      expect(hardwarePalette).toEqual([0x54, 0x44, 0x55, 0x40, 0x4b])
    })
  })

  describe('generateCPCPlusPalette', () => {
    it('should return 4096 colors', () => {
      const palette = generateCPCPlusPalette()
      expect(palette).toHaveLength(4096)
    })

    it('should generate valid RGB values', () => {
      const palette = generateCPCPlusPalette()

      // Check first few colors
      expect(palette[0]).toEqual([0, 0, 0]) // 000
      expect(palette[1]).toEqual([0, 0, 17]) // 001 (b=1)
      expect(palette[16]).toEqual([0, 17, 0]) // 010 (g=1)
      expect(palette[256]).toEqual([17, 0, 0]) // 100 (r=1)

      // Check last color
      expect(palette[4095]).toEqual([255, 255, 255]) // 15,15,15 scaled to 255
    })

    it('should scale 4-bit values correctly', () => {
      const palette = generateCPCPlusPalette()

      // Test specific scaling: 4-bit value 7 should become ~119 (7/15 * 255)
      const expected7 = Math.round((7 / 15) * 255) // ~119
      const expected15 = 255 // Max 4-bit value (15) scaled to 255

      // Find a color with value 7 in red channel
      const colorWith7 = palette.find(([r]) => r === expected7)
      expect(colorWith7).toBeDefined()

      // Check max value
      const maxColor = palette[4095]
      expect(maxColor[0]).toBe(expected15)
      expect(maxColor[1]).toBe(expected15)
      expect(maxColor[2]).toBe(expected15)
    })
  })

  describe('getPaletteForHardware', () => {
    it('should return classic palette for CLASSIC hardware', () => {
      const palette = getPaletteForHardware(CPCHardware.CLASSIC)
      expect(palette).toHaveLength(27)
      expect(palette).toEqual(generateAmstradCPCPalette())
    })

    it('should return plus palette for PLUS hardware', () => {
      const palette = getPaletteForHardware(CPCHardware.PLUS)
      expect(palette).toHaveLength(4096)
      expect(palette).toEqual(generateCPCPlusPalette())
    })

    it('should fallback to classic for unknown hardware', () => {
      const palette = getPaletteForHardware('unknown' as any)
      expect(palette).toHaveLength(27)
      expect(palette).toEqual(generateAmstradCPCPalette())
    })
  })

  describe('cpcPalette export', () => {
    it('should export the classic palette', () => {
      expect(cpcPalette).toHaveLength(27)
      expect(cpcPalette).toEqual(generateAmstradCPCPalette())
    })
  })
})