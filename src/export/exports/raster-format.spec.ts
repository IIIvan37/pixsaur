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
      expect(asm).toContain('DB #00') // No change marker (single byte)
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
      expect(asm).toContain('DB 1, 1, #54') // Line 10: Ink 1, hardware color 0x54 (black)
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
    it('should generate ASM with all colors for every line in reverse order (no #00 marker)', () => {
      // Base palette: ink0=black, ink1=blue, ink2=green, ink3=red
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00]
      const asm = generatePlusRasterASM([], 3, basePalette)

      expect(asm).toContain('RasterData:')
      expect(asm).toContain('3 lines')
      expect(asm).toContain('4 raster slots')
      expect(asm).toContain('reverse order for stack loading')
      // No #00 marker - all lines have colors
      expect(asm).not.toContain('DB #00')
      // All 3 lines should have the base palette colors in REVERSE order (ink3, ink2, ink1, ink0)
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 0')
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 1')
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 2')
    })

    it('should generate ASM with all 4 slot colors per line in reverse order', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 2,
          inkIndex: 2,
          color: [255, 0, 0] // Bright red = CPC Plus format 0GRB: G=0, R=15, B=0 = 0x0F0
        }
      ]
      // Base palette: ink0=black, ink1=blue, ink2=green, ink3=red
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00]
      const asm = generatePlusRasterASM(changes, 4, basePalette)

      expect(asm).toContain('RasterData:')
      // Lines 0-1: base palette in reverse order (ink3, ink2, ink1, ink0)
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 0')
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 1')
      // Line 2: ink2 changed to red (0x0F0), in reverse order: ink3=0xF00, ink2=0x0F0, ink1=0x00F, ink0=0x000
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 2')
      // Line 3: same as line 2 (colors persist)
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 3')
    })

    it('should handle multiple changes on same line (Mode 0 Plus allows 4 raster slots)', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 1,
          inkIndex: 0,
          color: [255, 255, 255] // White = G=15, R=15, B=15 = 0xFFF
        },
        {
          id: 'test-2',
          line: 1,
          inkIndex: 1,
          color: [255, 0, 255] // Magenta = G=0, R=15, B=15 = 0x0FF
        }
      ]
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00]
      const asm = generatePlusRasterASM(changes, 3, basePalette)

      // Line 0: base palette in reverse order (ink3, ink2, ink1, ink0)
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 0')
      // Line 1: ink0=white(0xFFF), ink1=magenta(0x0FF), ink2=green(0x0F0), ink3=red(0xF00)
      // In reverse order: ink3=0xF00, ink2=0x0F0, ink1=0x0FF, ink0=0xFFF
      expect(asm).toContain('DW #F00, #0F0, #0FF, #FFF    ; Line 1')
      // Line 2: same as line 1 (colors persist)
      expect(asm).toContain('DW #F00, #0F0, #0FF, #FFF    ; Line 2')
    })

    it('should handle changes on different lines with state persistence', () => {
      const changes: RasterChange[] = [
        {
          id: 'test-1',
          line: 1,
          inkIndex: 0,
          color: [255, 255, 255] // White = 0xFFF
        },
        {
          id: 'test-2',
          line: 3,
          inkIndex: 1,
          color: [0, 255, 0] // Green = 0xF00
        }
      ]
      const basePalette = [0x000, 0x00f, 0x0f0, 0xf00]
      const asm = generatePlusRasterASM(changes, 5, basePalette)

      // Line 0: base palette in reverse order (ink3, ink2, ink1, ink0)
      expect(asm).toContain('DW #F00, #0F0, #00F, #000    ; Line 0')
      // Line 1: ink0=white(0xFFF), others unchanged -> reverse: ink3, ink2, ink1, ink0
      expect(asm).toContain('DW #F00, #0F0, #00F, #FFF    ; Line 1')
      // Line 2: same as line 1 (no change, colors persist)
      expect(asm).toContain('DW #F00, #0F0, #00F, #FFF    ; Line 2')
      // Line 3: ink0 still white, ink1=green(0xF00) -> reverse: ink3=0xF00, ink2=0x0F0, ink1=0xF00, ink0=0xFFF
      expect(asm).toContain('DW #F00, #0F0, #F00, #FFF    ; Line 3')
      // Line 4: same as line 3
      expect(asm).toContain('DW #F00, #0F0, #F00, #FFF    ; Line 4')
    })

    it('should track palette state across lines', () => {
      const changes: RasterChange[] = [
        { id: 'test-1', line: 1, inkIndex: 0, color: [255, 0, 0] }, // Red = 0x0F0
        { id: 'test-2', line: 3, inkIndex: 1, color: [0, 255, 0] } // Green = 0xF00
      ]
      const basePalette = [0x000, 0x000, 0x000, 0x000] // All black
      const asm = generatePlusRasterASM(changes, 5, basePalette)

      // Line 0: all black (base palette) in reverse order
      expect(asm).toContain('DW #000, #000, #000, #000    ; Line 0')
      // Line 1: ink0 becomes red (0x0F0), others stay black -> reverse: ink3, ink2, ink1, ink0
      expect(asm).toContain('DW #000, #000, #000, #0F0    ; Line 1')
      // Line 2: same as line 1 (no change)
      expect(asm).toContain('DW #000, #000, #000, #0F0    ; Line 2')
      // Line 3: ink0 stays red (0x0F0), ink1 becomes green (0xF00) -> reverse: ink3, ink2, ink1, ink0
      expect(asm).toContain('DW #000, #000, #F00, #0F0    ; Line 3')
      // Line 4: same as line 3
      expect(asm).toContain('DW #000, #000, #F00, #0F0    ; Line 4')
    })

    it('should support custom number of raster slots (2 slots)', () => {
      const changes: RasterChange[] = [
        { id: 'test-1', line: 1, inkIndex: 1, color: [255, 255, 255] } // White = 0xFFF
      ]
      // Only 2 raster slots
      const basePalette = [0x000, 0x00f] // Black, Blue
      const asm = generatePlusRasterASM(
        changes,
        3,
        basePalette,
        'RasterData',
        2
      )

      expect(asm).toContain('2 raster slots')
      // Line 0: base palette (2 colors only) in reverse order: ink1, ink0
      expect(asm).toContain('DW #00F, #000    ; Line 0')
      // Line 1: ink0=black(0x000), ink1=white(0xFFF) -> reverse: ink1, ink0
      expect(asm).toContain('DW #FFF, #000    ; Line 1')
      // Line 2: same as line 1
      expect(asm).toContain('DW #FFF, #000    ; Line 2')
    })

    it('should support 1 raster slot', () => {
      const changes: RasterChange[] = [
        { id: 'test-1', line: 1, inkIndex: 0, color: [255, 0, 0] } // Red = 0x0F0
      ]
      const basePalette = [0x000] // Black only
      const asm = generatePlusRasterASM(
        changes,
        3,
        basePalette,
        'RasterData',
        1
      )

      expect(asm).toContain('1 raster slots')
      // Line 0: black (single slot, reverse doesn't change anything)
      expect(asm).toContain('DW #000    ; Line 0')
      // Line 1: red
      expect(asm).toContain('DW #0F0    ; Line 1')
      // Line 2: red (persists)
      expect(asm).toContain('DW #0F0    ; Line 2')
    })

    it('should ignore changes for ink indices beyond numRasterSlots', () => {
      const changes: RasterChange[] = [
        { id: 'test-1', line: 1, inkIndex: 0, color: [255, 0, 0] }, // Red = 0x0F0 (valid)
        { id: 'test-2', line: 1, inkIndex: 2, color: [0, 255, 0] } // Green (ignored, only 2 slots)
      ]
      const basePalette = [0x000, 0x00f] // Black, Blue
      const asm = generatePlusRasterASM(
        changes,
        3,
        basePalette,
        'RasterData',
        2
      )

      // Line 1: only ink0 changed, ink2 change ignored -> reverse: ink1, ink0
      expect(asm).toContain('DW #00F, #0F0    ; Line 1')
    })
  })
})
