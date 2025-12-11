import { describe, expect, it } from 'vitest'
import {
  firmwareToHardware,
  getHardwarePalette,
  injectPaletteDataIntoSCR
} from './cpc-format'

describe('cpc-format', () => {
  describe('firmwareToHardware', () => {
    it('should have 27 entries for all CPC colors', () => {
      expect(firmwareToHardware).toHaveLength(27)
    })

    it('should map firmware 0 (Black) to hardware 0x54', () => {
      expect(firmwareToHardware[0]).toBe(0x54)
    })

    it('should map firmware 1 (Blue) to hardware 0x44', () => {
      expect(firmwareToHardware[1]).toBe(0x44)
    })

    it('should map firmware 26 (Bright White) to hardware 0x4b', () => {
      expect(firmwareToHardware[26]).toBe(0x4b)
    })

    it('should map firmware 13 (White) to hardware 0x40', () => {
      expect(firmwareToHardware[13]).toBe(0x40)
    })
  })

  describe('getHardwarePalette', () => {
    it('should convert firmware indices to hardware values', () => {
      const firmware = [0, 1, 13] // Black, Blue, White
      const hardware = getHardwarePalette(firmware)
      expect(hardware).toEqual([0x54, 0x44, 0x40])
    })

    it('should handle empty palette', () => {
      expect(getHardwarePalette([])).toEqual([])
    })

    it('should handle all colors', () => {
      const allFirmware = Array.from({ length: 27 }, (_, i) => i)
      const allHardware = getHardwarePalette(allFirmware)
      expect(allHardware).toHaveLength(27)
      expect(allHardware).toEqual(firmwareToHardware)
    })
  })

  describe('injectPaletteDataIntoSCR', () => {
    it('should throw error if buffer is too small', () => {
      const scr = new Uint8Array(100)
      expect(() => injectPaletteDataIntoSCR(scr, [0], 0)).toThrow(
        'SCR buffer must be at least 2048 bytes'
      )
    })

    it('should throw error if palette is empty', () => {
      const scr = new Uint8Array(2048)
      expect(() => injectPaletteDataIntoSCR(scr, [], 0)).toThrow(
        'CPC Classic requires at least 1 color'
      )
    })

    it('should inject border color (firmware) at offset 2000', () => {
      const scr = new Uint8Array(2048)
      injectPaletteDataIntoSCR(scr, [5, 1, 2], 1) // Mauve as border
      expect(scr[2000]).toBe(5) // Firmware index
    })

    it('should inject border color (hardware) at offset 2017', () => {
      const scr = new Uint8Array(2048)
      injectPaletteDataIntoSCR(scr, [5, 1, 2], 1) // Mauve as border
      expect(scr[2017]).toBe(0x5d) // Hardware value for Mauve
    })

    it('should inject palette firmware colors at offsets 2001-2016', () => {
      const scr = new Uint8Array(2048)
      injectPaletteDataIntoSCR(scr, [0, 1, 13, 26], 1)

      expect(scr[2001]).toBe(0) // Black
      expect(scr[2002]).toBe(1) // Blue
      expect(scr[2003]).toBe(13) // White
      expect(scr[2004]).toBe(26) // Bright White
    })

    it('should inject palette hardware colors at offsets 2018-2033', () => {
      const scr = new Uint8Array(2048)
      injectPaletteDataIntoSCR(scr, [0, 1, 13, 26], 1)

      expect(scr[2018]).toBe(0x54) // Black
      expect(scr[2019]).toBe(0x44) // Blue
      expect(scr[2020]).toBe(0x40) // White
      expect(scr[2021]).toBe(0x4b) // Bright White
    })

    it('should set graphics mode at offset 2034', () => {
      const scr = new Uint8Array(2048)

      injectPaletteDataIntoSCR(scr, [0], 0)
      expect(scr[2034]).toBe(0)

      injectPaletteDataIntoSCR(scr, [0], 1)
      expect(scr[2034]).toBe(1)

      injectPaletteDataIntoSCR(scr, [0], 2)
      expect(scr[2034]).toBe(2)
    })

    it('should set hardware type to Classic (0) at offset 2035', () => {
      const scr = new Uint8Array(2048)
      injectPaletteDataIntoSCR(scr, [0], 1)
      expect(scr[2035]).toBe(0)
    })

    it('should handle 16-color palette correctly', () => {
      const scr = new Uint8Array(2048)
      const palette16 = Array.from({ length: 16 }, (_, i) => i)

      injectPaletteDataIntoSCR(scr, palette16, 0)

      // Verify all 16 firmware colors
      for (let i = 0; i < 16; i++) {
        expect(scr[2001 + i]).toBe(i)
        expect(scr[2018 + i]).toBe(firmwareToHardware[i])
      }
    })

    it('should truncate palette longer than 16 colors', () => {
      const scr = new Uint8Array(2048)
      const palette20 = Array.from({ length: 20 }, (_, i) => i % 27)

      injectPaletteDataIntoSCR(scr, palette20, 0)

      // Only first 16 should be written
      expect(scr[2001]).toBe(0)
      expect(scr[2016]).toBe(15)
      // Offset 2017 is border hardware, not palette
    })
  })
})
