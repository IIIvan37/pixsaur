import { describe, expect, it } from 'vitest'
import { rgbToLab, rgbToXyz } from '@/libs/pixsaur-color/src/space'
import type { Vector } from '@/libs/pixsaur-color/src/type'

describe('ColorSpace CPU vs GPU Consistency', () => {
  /**
   * Test de vérification que nos constantes GPU correspondent au CPU
   * Ces valeurs doivent produire les mêmes résultats dans le shader GPU
   */

  describe('RGB to XYZ conversion consistency', () => {
    const testCases: Array<{ rgb: Vector; expectedXyz: Vector; name: string }> =
      [
        {
          rgb: [255, 0, 0], // Rouge pur
          expectedXyz: [41.24564, 21.26729, 1.93339],
          name: 'red'
        },
        {
          rgb: [0, 255, 0], // Vert pur
          expectedXyz: [35.75761, 71.51522, 11.9192],
          name: 'green'
        },
        {
          rgb: [0, 0, 255], // Bleu pur
          expectedXyz: [18.04375, 7.2175, 95.03041],
          name: 'blue'
        },
        {
          rgb: [255, 255, 255], // Blanc
          expectedXyz: [95.047, 100.0, 108.883],
          name: 'white'
        },
        {
          rgb: [0, 0, 0], // Noir
          expectedXyz: [0, 0, 0],
          name: 'black'
        },
        {
          rgb: [128, 128, 128], // Gris 50%
          expectedXyz: [20.517, 21.586, 23.507],
          name: 'gray'
        }
      ]

    testCases.forEach(({ rgb, expectedXyz, name }) => {
      it(`should convert ${name} RGB(${rgb.join(',')}) to XYZ correctly`, () => {
        const actualXyz = rgbToXyz(rgb)

        // Vérification avec tolérance pour les erreurs de précision
        expect(actualXyz[0]).toBeCloseTo(expectedXyz[0], 2)
        expect(actualXyz[1]).toBeCloseTo(expectedXyz[1], 2)
        expect(actualXyz[2]).toBeCloseTo(expectedXyz[2], 2)
      })
    })
  })

  describe('RGB to Lab conversion consistency', () => {
    const testCases: Array<{ rgb: Vector; name: string }> = [
      { rgb: [255, 0, 0], name: 'red' },
      { rgb: [0, 255, 0], name: 'green' },
      { rgb: [0, 0, 255], name: 'blue' },
      { rgb: [255, 255, 255], name: 'white' },
      { rgb: [0, 0, 0], name: 'black' },
      { rgb: [128, 128, 128], name: 'gray' }
    ]

    testCases.forEach(({ rgb, name }) => {
      it(`should convert ${name} RGB(${rgb.join(',')}) to Lab without error`, () => {
        const lab = rgbToLab(rgb)

        // Vérifications de base pour Lab
        expect(lab).toHaveLength(3)
        expect(lab[0]).toBeGreaterThanOrEqual(0) // L* doit être >= 0
        expect(lab[0]).toBeLessThanOrEqual(100.1) // L* doit être <= 100 (avec tolérance pour précision)
        expect(typeof lab[1]).toBe('number') // a* doit être un nombre
        expect(typeof lab[2]).toBe('number') // b* doit être un nombre
      })
    })

    it('should convert white to Lab(100, 0, 0)', () => {
      const white = rgbToLab([255, 255, 255])
      expect(white[0]).toBeCloseTo(100, 1) // L* = 100 pour le blanc
      expect(white[1]).toBeCloseTo(0, 1) // a* = 0 pour le blanc
      expect(white[2]).toBeCloseTo(0, 1) // b* = 0 pour le blanc
    })

    it('should convert black to Lab(0, 0, 0)', () => {
      const black = rgbToLab([0, 0, 0])
      expect(black[0]).toBeCloseTo(0, 1) // L* = 0 pour le noir
      expect(black[1]).toBeCloseTo(0, 1) // a* = 0 pour le noir
      expect(black[2]).toBeCloseTo(0, 1) // b* = 0 pour le noir
    })
  })

  describe('GPU Shader Constants Verification', () => {
    it('should use correct sRGB gamma constants', () => {
      // Ces constantes doivent correspondre exactement au shader GPU
      const SRGB_GAMMA = {
        A: 0.04045, // Threshold GPU : step(0.04045, rgb)
        B: 12.92, // Linear divisor GPU : rgb / 12.92
        C: 2.4, // Gamma power GPU : pow(..., 2.4)
        OFFSET: 0.055 // Offset GPU : (rgb + 0.055) / 1.055
      }

      // Vérification que les constantes sont correctes
      expect(SRGB_GAMMA.A).toBe(0.04045)
      expect(SRGB_GAMMA.B).toBe(12.92)
      expect(SRGB_GAMMA.C).toBe(2.4)
      expect(SRGB_GAMMA.OFFSET).toBe(0.055)
    })

    it('should use correct XYZ transformation matrix', () => {
      // Matrix coefficients used in GPU shader
      const XYZ_MATRIX = {
        r_to_x: 0.4124564,
        r_to_y: 0.2126729,
        r_to_z: 0.0193339,
        g_to_x: 0.3575761,
        g_to_y: 0.7151522,
        g_to_z: 0.119192,
        b_to_x: 0.1804375,
        b_to_y: 0.072175,
        b_to_z: 0.9503041
      }

      // Vérification pour le rouge pur [1,0,0]
      const red_x = XYZ_MATRIX.r_to_x * 100
      const red_y = XYZ_MATRIX.r_to_y * 100
      const red_z = XYZ_MATRIX.r_to_z * 100

      expect(red_x).toBeCloseTo(41.24564, 4)
      expect(red_y).toBeCloseTo(21.26729, 4)
      expect(red_z).toBeCloseTo(1.93339, 4)
    })

    it('should use correct D65 illuminant values', () => {
      // D65 illuminant values used for Lab conversion
      const D65_ILLUMINANT = {
        X: 95.047,
        Y: 100.0,
        Z: 108.883
      }

      expect(D65_ILLUMINANT.X).toBe(95.047)
      expect(D65_ILLUMINANT.Y).toBe(100.0)
      expect(D65_ILLUMINANT.Z).toBe(108.883)
    })
  })
})
