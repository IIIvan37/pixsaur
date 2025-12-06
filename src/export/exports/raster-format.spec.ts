import { describe, expect, it } from 'vitest'
import type { RasterRange } from '@/libs/pixsaur-raster/types'
import {
  expandRasterRanges,
  generateClassicRasterASM,
  generatePlusRasterASM,
  groupByLine,
  rgbToClassicHardware,
  rgbToFirmwareIndex
} from './raster-format'

describe('raster-format', () => {
  describe('rgbToFirmwareIndex', () => {
    it('should return 0 for black', () => {
      expect(rgbToFirmwareIndex(0, 0, 0)).toBe(0)
    })

    it('should return 26 for bright white', () => {
      expect(rgbToFirmwareIndex(255, 255, 255)).toBe(26)
    })

    it('should return 6 for bright red', () => {
      expect(rgbToFirmwareIndex(255, 0, 0)).toBe(6)
    })

    it('should return 18 for bright green', () => {
      expect(rgbToFirmwareIndex(0, 255, 0)).toBe(18)
    })

    it('should return 2 for bright blue', () => {
      expect(rgbToFirmwareIndex(0, 0, 255)).toBe(2)
    })
  })

  describe('rgbToClassicHardware', () => {
    it('should return 0x54 for black (firmware 0)', () => {
      expect(rgbToClassicHardware(0, 0, 0)).toBe(0x54)
    })

    it('should return 0x4b for bright white (firmware 26)', () => {
      expect(rgbToClassicHardware(255, 255, 255)).toBe(0x4b)
    })

    it('should return 0x4c for bright red (firmware 6)', () => {
      expect(rgbToClassicHardware(255, 0, 0)).toBe(0x4c)
    })
  })

  describe('expandRasterRanges', () => {
    it('should expand a single range to multiple lines', () => {
      const ranges: RasterRange[] = [
        {
          id: 'test-1',
          startLine: 10,
          endLine: 12,
          inkIndex: 1,
          color: [255, 0, 0]
        }
      ]

      const entries = expandRasterRanges(ranges)

      expect(entries).toHaveLength(3)
      expect(entries[0].line).toBe(10)
      expect(entries[1].line).toBe(11)
      expect(entries[2].line).toBe(12)
      expect(entries.every((e) => e.inkIndex === 1)).toBe(true)
    })

    it('should sort entries by line number', () => {
      const ranges: RasterRange[] = [
        {
          id: 'test-1',
          startLine: 50,
          endLine: 51,
          inkIndex: 1,
          color: [255, 0, 0]
        },
        {
          id: 'test-2',
          startLine: 10,
          endLine: 11,
          inkIndex: 2,
          color: [0, 255, 0]
        }
      ]

      const entries = expandRasterRanges(ranges)

      expect(entries[0].line).toBe(10)
      expect(entries[1].line).toBe(11)
      expect(entries[2].line).toBe(50)
      expect(entries[3].line).toBe(51)
    })
  })

  describe('groupByLine', () => {
    it('should group entries by line number', () => {
      const ranges: RasterRange[] = [
        {
          id: 'test-1',
          startLine: 10,
          endLine: 10,
          inkIndex: 1,
          color: [255, 0, 0]
        },
        {
          id: 'test-2',
          startLine: 10,
          endLine: 10,
          inkIndex: 2,
          color: [0, 255, 0]
        }
      ]

      const entries = expandRasterRanges(ranges)
      const grouped = groupByLine(entries)

      expect(grouped.size).toBe(1)
      expect(grouped.get(10)?.length).toBe(2)
    })
  })

  describe('generateClassicRasterASM', () => {
    it('should generate ASM with no-change markers for lines without rasters', () => {
      const basePalette = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      const asm = generateClassicRasterASM([], 200, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('200 lines')
      expect(asm).toContain('DB #FF, #FF') // No change marker
    })

    it('should generate ASM for a single range and restore after', () => {
      const ranges: RasterRange[] = [
        {
          id: 'test-1',
          startLine: 10,
          endLine: 10,
          inkIndex: 1,
          color: [0, 0, 0] // Black = firmware 0 = hardware 0x54
        }
      ]
      // Ink 1 originally has firmware color 1 = hardware 0x44 (blue)
      const basePalette = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      const asm = generateClassicRasterASM(ranges, 200, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('DB 1, #54') // Line 10: Ink 1, hardware color 0x54 (black)
      expect(asm).toContain('Line 10')
      // Line 11 should restore ink 1 to its original color (firmware 1 = hardware 0x44)
      expect(asm).toContain('restore ink 1')
    })

    it('should use custom label name', () => {
      const basePalette = [0, 1, 2, 3]
      const asm = generateClassicRasterASM([], 200, basePalette, 'MyRasters')

      expect(asm).toContain('MyRasters:')
    })

    it('should handle custom image heights', () => {
      const basePalette = [0, 1, 2, 3]
      const asm = generateClassicRasterASM([], 272, basePalette)

      expect(asm).toContain('272 lines')
    })
  })

  describe('generatePlusRasterASM', () => {
    it('should generate ASM with no-change markers for lines without rasters', () => {
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00] // Black, Blue, Green, Red
      const asm = generatePlusRasterASM([], 200, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('200 lines')
      expect(asm).toContain('DB #FF, #FF, #FF') // No change marker (3 bytes)
    })

    it('should generate ASM with 3-byte entries and restore after', () => {
      const ranges: RasterRange[] = [
        {
          id: 'test-1',
          startLine: 20,
          endLine: 20,
          inkIndex: 2,
          color: [255, 0, 0] // Bright red = CPC Plus format 0GRB: 0x0F0
        }
      ]
      // Ink 2 originally has CPC Plus color 0x0F0 (green)
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00]
      const asm = generatePlusRasterASM(ranges, 200, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('DB 2, #F0, #00') // Line 20: Ink 2, color 0x0F0 little-endian
      expect(asm).toContain('Line 20')
      // Line 21 should restore ink 2 to its original color (0x0F0)
      expect(asm).toContain('restore ink 2')
    })
  })
})
