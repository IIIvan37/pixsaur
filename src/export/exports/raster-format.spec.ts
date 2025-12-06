import { describe, expect, it } from 'vitest'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import {
  generateClassicRasterASM,
  generatePlusRasterASM,
  groupChangesByLine,
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

  describe('groupChangesByLine', () => {
    it('should group changes by line number', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 10,
          inkIndex: 1,
          color: [255, 0, 0]
        },
        {
          id: 'test-2',
          line: 10,
          inkIndex: 2,
          color: [0, 255, 0]
        },
        {
          id: 'test-3',
          line: 20,
          inkIndex: 1,
          color: [0, 0, 255]
        }
      ]

      const grouped = groupChangesByLine(changes)

      expect(grouped.size).toBe(2)
      expect(grouped.get(10)?.length).toBe(2)
      expect(grouped.get(20)?.length).toBe(1)
    })

    it('should return empty map for empty changes array', () => {
      const grouped = groupChangesByLine([])
      expect(grouped.size).toBe(0)
    })

    it('should handle multiple changes on same line', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 10,
          inkIndex: 3,
          color: [255, 0, 0]
        },
        {
          id: 'test-2',
          line: 10,
          inkIndex: 1,
          color: [0, 255, 0]
        }
      ]

      const grouped = groupChangesByLine(changes)
      const lineChanges = grouped.get(10)

      expect(lineChanges).toHaveLength(2)
      // Both changes should be present, order preserved from input
      expect(lineChanges?.map((c) => c.inkIndex)).toContain(1)
      expect(lineChanges?.map((c) => c.inkIndex)).toContain(3)
    })
  })

  describe('generateClassicRasterASM', () => {
    it('should generate ASM with no-change markers for lines without rasters', () => {
      const basePalette = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      const asm = generateClassicRasterASM([], 200, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('200 lines')
      expect(asm).toContain('DB #FF') // No change marker (single byte)
    })

    it('should generate ASM for a single change', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 10,
          inkIndex: 1,
          color: [0, 0, 0] // Black = firmware 0 = hardware 0x54
        }
      ]
      // Ink 1 originally has firmware color 1 = hardware 0x44 (blue)
      const basePalette = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      const asm = generateClassicRasterASM(changes, 200, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('DB 1, #54') // Line 10: Ink 1, hardware color 0x54 (black)
      expect(asm).toContain('Line 10')
      // Line 11 should NOT restore - ink keeps its color until next explicit change
      expect(asm).not.toContain('restore')
      // Line 11 should be no-change
      expect(asm).toContain('Line 11 - no change')
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

    it('should handle multiple changes on different lines', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 10,
          inkIndex: 1,
          color: [0, 0, 0]
        },
        {
          id: 'test-2',
          line: 50,
          inkIndex: 2,
          color: [255, 0, 0]
        }
      ]
      const basePalette = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      const asm = generateClassicRasterASM(changes, 200, basePalette)

      expect(asm).toContain('Line 10')
      expect(asm).toContain('Line 50')
    })
  })

  describe('generatePlusRasterASM', () => {
    it('should generate ASM with no-change markers for lines without rasters', () => {
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00] // Black, Blue, Green, Red
      const asm = generatePlusRasterASM([], 200, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('200 lines')
      expect(asm).toContain('DB #FF') // No change marker (single byte)
    })

    it('should generate ASM with 3-byte entries', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 20,
          inkIndex: 2,
          color: [255, 0, 0] // Bright red = CPC Plus format 0GRB: 0x0F0
        }
      ]
      // Ink 2 originally has CPC Plus color 0x0F0 (green)
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00]
      const asm = generatePlusRasterASM(changes, 200, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('DB 2, #F0, #00') // Line 20: Ink 2, color 0x0F0 little-endian
      expect(asm).toContain('Line 20')
      // Line 21 should NOT restore - ink keeps its color until next explicit change
      expect(asm).not.toContain('restore')
      // Line 21 should be no-change
      expect(asm).toContain('Line 21 - no change')
    })

    it('should handle multiple changes on different lines', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 10,
          inkIndex: 0,
          color: [255, 255, 255]
        },
        {
          id: 'test-2',
          line: 30,
          inkIndex: 1,
          color: [0, 255, 0]
        }
      ]
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00]
      const asm = generatePlusRasterASM(changes, 200, basePalette)

      expect(asm).toContain('Line 10')
      expect(asm).toContain('Line 30')
    })
  })
})
