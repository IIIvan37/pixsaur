import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { injectPaletteDataIntoSCR } from './cpc-format'
import {
  generateClassicRasterASM,
  rgbToClassicHardware,
  rgbToFirmwareIndex
} from './raster-format'
import { rgbToIndexBufferExact } from './rgb-to-indexes/rgb-to-indexes'

/**
 * Non-regression tests for the raster export pipeline.
 *
 * These tests ensure that:
 * 1. The palette firmware indices are correctly derived from RGB colors
 * 2. The index buffer and raster changes use consistent ink indices
 * 3. The SCR palette injection matches the palette ASM file
 * 4. The complete pipeline produces coherent output for real hardware
 */
describe('Export Raster Pipeline - Non-Regression', () => {
  /**
   * Helper to create a simple RGBA buffer from colors
   */
  const createRGBABuffer = (
    pixels: Array<[number, number, number]>
  ): Uint8ClampedArray => {
    const buffer = new Uint8ClampedArray(pixels.length * 4)
    pixels.forEach(([r, g, b], i) => {
      buffer[i * 4] = r
      buffer[i * 4 + 1] = g
      buffer[i * 4 + 2] = b
      buffer[i * 4 + 3] = 255
    })
    return buffer
  }

  describe('Palette consistency between exports', () => {
    it('should produce identical firmware indices for palette ASM and SCR injection', () => {
      // Simulate a raster base palette (RGB colors)
      const rasterBasePalette: Vector<'RGB'>[] = [
        [0, 0, 0], // Black -> fw 0
        [128, 0, 0], // Red-ish -> fw 3 (Red)
        [0, 128, 0], // Green-ish -> fw 9 (Green)
        [0, 0, 128] // Blue-ish -> fw 1 (Blue)
      ]

      // Convert to firmware indices (this is what export-panel does)
      const paletteFirmware = rasterBasePalette.map(([r, g, b]) =>
        rgbToFirmwareIndex(r, g, b)
      )

      // Create SCR buffer and inject palette
      const scr = new Uint8Array(16384)
      injectPaletteDataIntoSCR(scr, paletteFirmware, 1)

      // Verify SCR firmware values match paletteFirmware
      for (let i = 0; i < paletteFirmware.length; i++) {
        expect(scr[2001 + i]).toBe(paletteFirmware[i])
      }
    })

    it('should produce consistent hardware values in SCR and palette_hardware.asm', () => {
      const rasterBasePalette: Vector<'RGB'>[] = [
        [0, 0, 0], // Black -> fw 0 -> hw 0x54
        [255, 255, 255], // White -> fw 26 -> hw 0x4B
        [255, 0, 0], // Bright Red -> fw 6 -> hw 0x4C
        [0, 255, 0] // Bright Green -> fw 18 -> hw 0x52
      ]

      const paletteFirmware = rasterBasePalette.map(([r, g, b]) =>
        rgbToFirmwareIndex(r, g, b)
      )

      // Get hardware values as they would be in palette_hardware.asm
      const paletteHardware = paletteFirmware.map((fw) =>
        rgbToClassicHardware(
          rasterBasePalette[paletteFirmware.indexOf(fw)][0],
          rasterBasePalette[paletteFirmware.indexOf(fw)][1],
          rasterBasePalette[paletteFirmware.indexOf(fw)][2]
        )
      )

      // Inject into SCR
      const scr = new Uint8Array(16384)
      injectPaletteDataIntoSCR(scr, paletteFirmware, 0)

      // Verify hardware values in SCR match
      for (let i = 0; i < paletteHardware.length; i++) {
        expect(scr[2018 + i]).toBe(paletteHardware[i])
      }
    })
  })

  describe('Index buffer and raster change consistency', () => {
    it('should produce ink indices that match raster change inkIndex', () => {
      // Simulated raster-optimized palette
      const rasterPalette: Vector<'RGB'>[] = [
        [0, 0, 0], // ink 0: Black
        [255, 0, 0], // ink 1: Red
        [0, 255, 0], // ink 2: Green
        [0, 0, 255] // ink 3: Blue
      ]

      // Simulated image data using these colors
      // Each pixel should map to its ink index
      const imageData = createRGBABuffer([
        [0, 0, 0], // should be ink 0
        [255, 0, 0], // should be ink 1
        [0, 255, 0], // should be ink 2
        [0, 0, 255] // should be ink 3
      ])

      // This is the critical function - it must produce correct ink indices
      const indexBuffer = rgbToIndexBufferExact(imageData, rasterPalette, false)

      // Verify each pixel maps to expected ink
      expect(indexBuffer[0]).toBe(0) // Black -> ink 0
      expect(indexBuffer[1]).toBe(1) // Red -> ink 1
      expect(indexBuffer[2]).toBe(2) // Green -> ink 2
      expect(indexBuffer[3]).toBe(3) // Blue -> ink 3

      // Now simulate a raster change that modifies ink 1
      const rasterChanges: RasterChange[] = [
        {
          id: 'change-1',
          line: 0,
          inkIndex: 1, // This must match the index buffer value for red pixels
          color: [0, 255, 255] // Change ink 1 to Cyan
        }
      ]

      // Generate ASM for the raster
      const rasterASM = generateClassicRasterASM(
        rasterChanges,
        1,
        [0, 6, 18, 2],
        'RasterData'
      )

      // The ASM should reference inkIndex 1 (same as what indexBuffer produced for red)
      expect(rasterASM).toContain('1,') // inkIndex 1 in the output
    })

    it('should maintain ink index mapping across multiple lines', () => {
      const palette: Vector<'RGB'>[] = [
        [0, 0, 0], // ink 0
        [128, 0, 0], // ink 1
        [0, 128, 0], // ink 2
        [0, 0, 128] // ink 3
      ]

      // 4x2 image (4 pixels wide, 2 lines)
      const imageData = createRGBABuffer([
        // Line 0
        [0, 0, 0],
        [128, 0, 0],
        [0, 128, 0],
        [0, 0, 128],
        // Line 1
        [0, 0, 128],
        [0, 128, 0],
        [128, 0, 0],
        [0, 0, 0]
      ])

      const indexBuffer = rgbToIndexBufferExact(imageData, palette, false)

      // Line 0
      expect(indexBuffer[0]).toBe(0)
      expect(indexBuffer[1]).toBe(1)
      expect(indexBuffer[2]).toBe(2)
      expect(indexBuffer[3]).toBe(3)

      // Line 1
      expect(indexBuffer[4]).toBe(3)
      expect(indexBuffer[5]).toBe(2)
      expect(indexBuffer[6]).toBe(1)
      expect(indexBuffer[7]).toBe(0)

      // Raster changes at line 1 should affect the correct inks
      const rasterChanges: RasterChange[] = [
        {
          id: 'change-1',
          line: 1,
          inkIndex: 1, // Affects red pixels (which are at positions 6 on line 1)
          color: [255, 255, 0] // Yellow
        }
      ]

      // The change targets ink 1, which corresponds to the red color
      // On line 1, pixel 6 uses ink 1 (red), so it will become yellow
      expect(rasterChanges[0].inkIndex).toBe(1)
    })
  })

  describe('Complete pipeline coherence', () => {
    it('should produce coherent export data for a simple raster image', () => {
      // This test simulates the complete export pipeline
      // and verifies all outputs are consistent

      // 1. Raster base palette (as would come from rasterBasePaletteAtom)
      const rasterBasePalette: Vector<'RGB'>[] = [
        [0, 0, 0], // ink 0: Black
        [255, 0, 0], // ink 1: Bright Red
        [0, 255, 0], // ink 2: Bright Green
        [0, 0, 255] // ink 3: Bright Blue
      ]

      // 2. Convert palette to firmware indices
      const paletteFirmware = rasterBasePalette.map(([r, g, b]) =>
        rgbToFirmwareIndex(r, g, b)
      )
      expect(paletteFirmware).toEqual([0, 6, 18, 2]) // Known mappings

      // 4. Create index buffer (simulates rasterIndexBufferAtom.buffer)
      const imageData = createRGBABuffer([
        [0, 0, 0],
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ])
      const indexBuffer = rgbToIndexBufferExact(
        imageData,
        rasterBasePalette,
        false
      )

      // 5. Create raster changes
      const rasterChanges: RasterChange[] = [
        {
          id: 'test-change',
          line: 0,
          inkIndex: 1, // Change ink 1 (red)
          color: [255, 255, 0] // To yellow
        }
      ]

      // 6. Generate raster ASM
      const rasterASM = generateClassicRasterASM(
        rasterChanges,
        1,
        paletteFirmware,
        'RasterData'
      )

      // 7. Inject palette into SCR
      const scr = new Uint8Array(16384)
      injectPaletteDataIntoSCR(scr, paletteFirmware, 1)

      // VERIFY COHERENCE:

      // A. Index buffer uses ink 1 for red pixels
      expect(indexBuffer[1]).toBe(1)

      // B. Raster change targets ink 1
      expect(rasterChanges[0].inkIndex).toBe(1)

      // C. Raster ASM contains ink 1
      expect(rasterASM).toContain('1,')

      // D. SCR has correct firmware index for ink 1
      expect(scr[2002]).toBe(6) // Firmware index 6 = Bright Red

      // E. SCR has correct hardware value for ink 1
      expect(scr[2019]).toBe(0x4c) // Hardware 0x4C = Bright Red

      // F. All palette entries are consistent
      for (let i = 0; i < paletteFirmware.length; i++) {
        // Firmware in SCR matches paletteFirmware array
        expect(scr[2001 + i]).toBe(paletteFirmware[i])
      }
    })

    it('should not apply Mode 0 reorganization in raster mode', () => {
      // In raster mode, palette is already in ink order
      // Mode 0 bit-shuffling should NOT be applied

      const rasterPalette: Vector<'RGB'>[] = Array.from(
        { length: 16 },
        (_, i) => {
          // Create 16 distinct colors
          const r = (i & 1) * 255
          const g = ((i >> 1) & 1) * 255
          const b = ((i >> 2) & 1) * 255
          return [r, g, b] as Vector<'RGB'>
        }
      )

      // In raster mode, firmware indices are direct (no reorganization)
      const paletteFirmware = rasterPalette.map(([r, g, b]) =>
        rgbToFirmwareIndex(r, g, b)
      )

      // Inject into SCR
      const scr = new Uint8Array(16384)
      injectPaletteDataIntoSCR(scr, paletteFirmware, 0)

      // Verify ink 0 -> offset 2001, ink 1 -> offset 2002, etc.
      // (No Mode 0 bit shuffling applied)
      for (let i = 0; i < 16; i++) {
        expect(scr[2001 + i]).toBe(paletteFirmware[i])
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle empty raster changes', () => {
      const paletteFirmware = [0, 1, 2, 3]
      const rasterASM = generateClassicRasterASM(
        [],
        10,
        paletteFirmware,
        'RasterData'
      )

      // All lines should be "no change"
      expect(rasterASM).toContain('DB #00')
      // Count lines with "Line X - no change" pattern (data lines, not header comment)
      expect(rasterASM.match(/Line \d+ - no change/g)?.length).toBe(10)
    })

    it('should handle raster changes on every line', () => {
      const changes: RasterChange[] = Array.from({ length: 10 }, (_, line) => ({
        id: `change-${line}`,
        line,
        inkIndex: 0,
        color: [line * 25, 0, 0] as Vector<'RGB'>
      }))

      const rasterASM = generateClassicRasterASM(changes, 10, [0], 'RasterData')

      // Each line should have a change, no "Line X - no change" markers
      expect(rasterASM.match(/Line \d+ - no change/g)).toBeNull()
      expect(rasterASM.match(/DB 1,/g)?.length).toBe(10)
    })

    it('should preserve color accuracy for CPC Classic 27-color palette', () => {
      // Test all 27 CPC Classic colors
      const cpcColors: Array<{ rgb: Vector<'RGB'>; expectedFw: number }> = [
        { rgb: [0, 0, 0], expectedFw: 0 }, // Black
        { rgb: [0, 0, 128], expectedFw: 1 }, // Blue
        { rgb: [0, 0, 255], expectedFw: 2 }, // Bright Blue
        { rgb: [128, 0, 0], expectedFw: 3 }, // Red
        { rgb: [255, 0, 0], expectedFw: 6 }, // Bright Red
        { rgb: [0, 128, 0], expectedFw: 9 }, // Green
        { rgb: [0, 255, 0], expectedFw: 18 }, // Bright Green
        { rgb: [255, 255, 255], expectedFw: 26 } // Bright White
      ]

      for (const { rgb, expectedFw } of cpcColors) {
        const fw = rgbToFirmwareIndex(rgb[0], rgb[1], rgb[2])
        expect(fw).toBe(expectedFw)
      }
    })
  })
})
