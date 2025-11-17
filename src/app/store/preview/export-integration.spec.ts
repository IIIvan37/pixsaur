import { describe, expect, it } from 'vitest'
import { rgbToIndexBufferExact } from '@/export'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'

describe('Export Integration with CPC Quantization', () => {
  it('should successfully export quantified colors without throwing', () => {
    // Simulate a reduced palette that has been quantified to CPC standards
    const quantifiedPalette: Vector[] = [
      [0, 0, 0], // Black
      [128, 0, 0], // Red (quantified from [125,3,41])
      [255, 255, 255], // White
      [0, 128, 255] // Sky Blue
    ]

    // Simulate image data using these quantified colors
    const imageData = new Uint8ClampedArray([
      0,
      0,
      0,
      255, // Black pixel
      128,
      0,
      0,
      255, // Red pixel (was [125,3,41])
      255,
      255,
      255,
      255, // White pixel
      0,
      128,
      255,
      255 // Sky Blue pixel
    ])

    // This should not throw an error
    expect(() => {
      const result = rgbToIndexBufferExact(imageData, quantifiedPalette)
      expect(Array.from(result)).toEqual([0, 1, 2, 3])
    }).not.toThrow()
  })

  it('should find all quantified colors in the full CPC palette', () => {
    const fullCPCPalette = generateAmstradCPCPalette()

    // Test problematic color that was causing the original error
    // Original: [125, 3, 41] -> Quantified: [128, 0, 0]
    const quantifiedColor = [128, 0, 0] // Quantified version

    // The quantified color should exist in the CPC palette
    const foundIndex = fullCPCPalette.findIndex(
      ([r, g, b]) =>
        r === quantifiedColor[0] &&
        g === quantifiedColor[1] &&
        b === quantifiedColor[2]
    )

    expect(foundIndex).not.toBe(-1)
    expect(foundIndex).toBe(3) // Should be index 3 (Red) in CPC palette
  })

  it('should quantify all common problematic RGB values to valid CPC colors', () => {
    const problematicColors = [
      [125, 3, 41], // Should become [128, 0, 0]
      [63, 190, 80], // Should become [0, 255, 128]
      [200, 200, 50], // Should become [255, 255, 0]
      [10, 10, 10] // Should become [0, 0, 0]
    ]

    const quantizeCPC = (value: number): number => {
      const levels = [0, 128, 255]
      let best = levels[0]
      let bestDist = Math.abs(value - best)

      for (const lvl of levels) {
        const dist = Math.abs(value - lvl)
        if (dist < bestDist) {
          bestDist = dist
          best = lvl
        }
      }
      return best
    }

    const fullCPCPalette = generateAmstradCPCPalette()

    for (const [r, g, b] of problematicColors) {
      const quantified = [quantizeCPC(r), quantizeCPC(g), quantizeCPC(b)]

      // Each quantified color should exist in the CPC palette
      const foundIndex = fullCPCPalette.findIndex(
        ([cr, cg, cb]) =>
          cr === quantified[0] && cg === quantified[1] && cb === quantified[2]
      )

      expect(
        foundIndex,
        `Quantified color [${quantified}] from original [${r},${g},${b}] should exist in CPC palette`
      ).not.toBe(-1)
    }
  })
})
