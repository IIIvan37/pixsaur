import { getRgbToColorSpaceFn, getColorSpaceToRgbFn } from '../../src/space'
import { Vector } from '../../src/type'

describe('Color space conversions', () => {
  describe('RGB to XYZ conversion', () => {
    const rgbTo = getRgbToColorSpaceFn('XYZ')
    it('should convert RGB to XYZ', () => {
      const rgb: Vector = [255, 0, 0] // Rouge
      const expectedXyz: Vector = [41.24564, 21.26729, 1.93339] // Valeurs XYZ attendues

      const xyz = rgbTo(rgb)

      expect(xyz[0]).toBeCloseTo(expectedXyz[0], 0)
      expect(xyz[1]).toBeCloseTo(expectedXyz[1], 0)
      expect(xyz[2]).toBeCloseTo(expectedXyz[2], 0)
    })
    it('should handle edge case of black (0, 0, 0)', () => {
      const rgb: Vector = [0, 0, 0] // Noir
      const expectedXyz: Vector = [0, 0, 0] // Valeurs XYZ attendues pour le noir

      const xyz = rgbTo(rgb)

      expect(xyz[0]).toBeCloseTo(expectedXyz[0], 0)
      expect(xyz[1]).toBeCloseTo(expectedXyz[1], 0)
      expect(xyz[2]).toBeCloseTo(expectedXyz[2], 0)
    })

    it('should handle edge case of white (255, 255, 255)', () => {
      const rgb: Vector = [255, 255, 255] // Blanc
      const expectedXyz: Vector = [95.047, 100.0, 108.883] // Valeurs XYZ attendues pour le blanc

      const xyz = rgbTo(rgb)

      expect(xyz[0]).toBeCloseTo(expectedXyz[0], 0)
      expect(xyz[1]).toBeCloseTo(expectedXyz[1], 0)
      expect(xyz[2]).toBeCloseTo(expectedXyz[2], 0)
    })

    it('should handle edge case of gray (128, 128, 128)', () => {
      const rgb: Vector = [128, 128, 128] // Gris
      const expectedXyz: Vector = [20.344, 21.404, 23.305] // Valeurs XYZ attendues pour le gris

      const xyz = rgbTo(rgb)

      expect(xyz[0]).toBeCloseTo(expectedXyz[0], 0)
      expect(xyz[1]).toBeCloseTo(expectedXyz[1], 0)
      expect(xyz[2]).toBeCloseTo(expectedXyz[2], 0)
    })

    it('should handle edge case of invalid RGB values', () => {
      const rgb: Vector = [-10, 300, 256] // Valeurs invalides
      const xyz = rgbTo(rgb)

      expect(xyz[0]).toBeGreaterThanOrEqual(0)
      expect(xyz[1]).toBeGreaterThanOrEqual(0)
      expect(xyz[2]).toBeGreaterThanOrEqual(0)
    })
  })
  describe('XYZ to RGB conversion', () => {
    const rgbFrom = getColorSpaceToRgbFn('XYZ')
    it('should convert XYZ to RGB', () => {
      const xyz: Vector = [41.24564, 21.26729, 1.93339] // XYZ pour le rouge
      const expectedRgb: Vector = [255, 0, 0] // Valeurs RGB attendues

      const rgb = rgbFrom(xyz)

      expect(rgb[0]).toBeCloseTo(expectedRgb[0], 0)
      expect(rgb[1]).toBeCloseTo(expectedRgb[1], 0)
      expect(rgb[2]).toBeCloseTo(expectedRgb[2], 0)
    })

    it('should handle edge case of black (0, 0, 0)', () => {
      const xyz: Vector = [0, 0, 0] // Noir
      const expectedRgb: Vector = [0, 0, 0] // Valeurs RGB attendues pour le noir

      const rgb = rgbFrom(xyz)

      expect(rgb[0]).toBeCloseTo(expectedRgb[0], 0)
      expect(rgb[1]).toBeCloseTo(expectedRgb[1], 0)
      expect(rgb[2]).toBeCloseTo(expectedRgb[2], 0)
    })

    it('should handle edge case of white (95.047, 100.0, 108.883)', () => {
      const xyz: Vector = [95.047, 100.0, 108.883] // Blanc
      const expectedRgb: Vector = [255, 255, 255] // Valeurs RGB attendues pour le blanc

      const rgb = rgbFrom(xyz)

      expect(rgb[0]).toBeCloseTo(expectedRgb[0], 0)
      expect(rgb[1]).toBeCloseTo(expectedRgb[1], 0)
      expect(rgb[2]).toBeCloseTo(expectedRgb[2], 0)
    })

    it('should handle edge case of invalid XYZ values', () => {
      const xyz: Vector = [-10, 300, 256] // Valeurs invalides
      const rgb = rgbFrom(xyz)

      expect(rgb[0]).toBeGreaterThanOrEqual(0)
      expect(rgb[1]).toBeGreaterThanOrEqual(0)
      expect(rgb[2]).toBeGreaterThanOrEqual(0)
    })
  })
  describe('RGB to Lab conversion', () => {
    const rgbTo = getRgbToColorSpaceFn('Lab')
    it('should convert RGB to Lab', () => {
      const rgb: Vector = [255, 0, 0] // Rouge
      const expectedLab: Vector = [53.2408, 80.0925, 67.2032] // Valeurs Lab attendues

      const lab = rgbTo(rgb)

      expect(lab[0]).toBeCloseTo(expectedLab[0], 0)
      expect(lab[1]).toBeCloseTo(expectedLab[1], 0)
      expect(lab[2]).toBeCloseTo(expectedLab[2], 0)
    })
    it('should handle edge case of black (0, 0, 0)', () => {
      const rgb: Vector = [0, 0, 0] // Noir
      const expectedLab: Vector = [0, 0, 0] // Valeurs Lab attendues pour le noir

      const lab = rgbTo(rgb)

      expect(lab[0]).toBeCloseTo(expectedLab[0], 0)
      expect(lab[1]).toBeCloseTo(expectedLab[1], 0)
      expect(lab[2]).toBeCloseTo(expectedLab[2], 0)
    })

    it('should handle edge case of white (255, 255, 255)', () => {
      const rgb: Vector = [255, 255, 255] // Blanc
      const expectedLab: Vector = [100, 0, 0] // Valeurs Lab attendues pour le blanc

      const lab = rgbTo(rgb)

      expect(lab[0]).toBeCloseTo(expectedLab[0], 0)
      expect(lab[1]).toBeCloseTo(expectedLab[1], 0)
      expect(lab[2]).toBeCloseTo(expectedLab[2], 0)
    })

    it('should handle edge case of gray (128, 128, 128)', () => {
      const rgb: Vector = [128, 128, 128] // Gris
      const expectedLab: Vector = [53.585, 0, 0] // Valeurs Lab attendues pour le gris

      const lab = rgbTo(rgb)

      expect(lab[0]).toBeCloseTo(expectedLab[0], 0)
      expect(lab[1]).toBeCloseTo(expectedLab[1], 0)
      expect(lab[2]).toBeCloseTo(expectedLab[2], 0)
    })
  })
  describe('Lab to RGB conversion', () => {
    const rgbFrom = getColorSpaceToRgbFn('Lab')

    it('should convert Lab to RGB (pure red)', () => {
      const lab: Vector = [53.2408, 80.0925, 67.2032] // Lab pour le rouge
      const expectedRgb: Vector = [255, 0, 0]

      const rgb = rgbFrom(lab)
      expect(rgb[0]).toBeCloseTo(expectedRgb[0], 0)
      expect(rgb[1]).toBeCloseTo(expectedRgb[1], 0)
      expect(rgb[2]).toBeCloseTo(expectedRgb[2], 0)
    })

    it('should handle edge case of black (0, 0, 0)', () => {
      const lab: Vector = [0, 0, 0] // Noir
      const expectedRgb: Vector = [0, 0, 0]

      const rgb = rgbFrom(lab)
      expect(rgb[0]).toBeCloseTo(expectedRgb[0], 0)
      expect(rgb[1]).toBeCloseTo(expectedRgb[1], 0)
      expect(rgb[2]).toBeCloseTo(expectedRgb[2], 0)
    })

    it('should handle edge case of white (100, 0, 0)', () => {
      const lab: Vector = [100, 0, 0] // Blanc
      const expectedRgb: Vector = [255, 255, 255]

      const rgb = rgbFrom(lab)
      expect(rgb[0]).toBeCloseTo(expectedRgb[0], 0)
      expect(rgb[1]).toBeCloseTo(expectedRgb[1], 0)
      expect(rgb[2]).toBeCloseTo(expectedRgb[2], 0)
    })
  })
})
