import { applyAdjustmentsInOnePass } from './adjust'

describe('adjust.ts', () => {
  describe('applyAdjustmentsInOnePass', () => {
    it('devrait appliquer tous les ajustements en une passe', () => {
      const input = new ImageData(2, 1)
      // Remplir les deux pixels
      input.data[0] = 128 // R pixel 1
      input.data[1] = 128 // G pixel 1
      input.data[2] = 128 // B pixel 1
      input.data[3] = 255 // A pixel 1
      input.data[4] = 64 // R pixel 2
      input.data[5] = 64 // G pixel 2
      input.data[6] = 64 // B pixel 2
      input.data[7] = 255 // A pixel 2

      const config = {
        rgb: { r: 1.2, g: 0.8, b: 1 },
        brightness: 1.1,
        contrast: 1.2,
        saturation: 1.5,
        hue: 30,
        vibrance: 20,
        temperature: 10,
        tint: -5,
        gamma: 1.1,
        exposure: 0.5,
        highlights: 10,
        shadows: -10,
        posterization: 8
      }

      const result = applyAdjustmentsInOnePass(input, config)

      expect(result).toBeInstanceOf(ImageData)
      expect(result.width).toBe(2)
      expect(result.height).toBe(1)
      expect(result.data.length).toBe(8) // 2x1 pixels * 4 canaux

      // Vérifier que l'alpha est préservé pour les deux pixels
      expect(result.data[3]).toBe(255)
      expect(result.data[7]).toBe(255)
    })

    it("devrait gérer les valeurs neutres (pas d'ajustement)", () => {
      const input = new ImageData(1, 1)
      input.data[0] = 100
      input.data[1] = 150
      input.data[2] = 200
      input.data[3] = 255

      const config = {
        rgb: { r: 1, g: 1, b: 1 },
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        gamma: 1,
        exposure: 0,
        highlights: 0,
        shadows: 0,
        posterization: 256
      }

      const result = applyAdjustmentsInOnePass(input, config)

      // Les valeurs devraient être approximativement les mêmes (avec arrondi)
      expect(Math.abs(result.data[0] - 100)).toBeLessThanOrEqual(1)
      expect(Math.abs(result.data[1] - 150)).toBeLessThanOrEqual(1)
      expect(Math.abs(result.data[2] - 200)).toBeLessThanOrEqual(1)
      expect(result.data[3]).toBe(255)
    })

    it('devrait clamper les valeurs entre 0 et 255', () => {
      const input = new ImageData(1, 1)
      input.data[0] = 255
      input.data[1] = 255
      input.data[2] = 255
      input.data[3] = 255

      const config = {
        rgb: { r: 2, g: 2, b: 2 }, // Va dépasser 255
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        gamma: 1,
        exposure: 0,
        highlights: 0,
        shadows: 0,
        posterization: 256
      }

      const result = applyAdjustmentsInOnePass(input, config)

      expect(result.data[0]).toBe(255)
      expect(result.data[1]).toBe(255)
      expect(result.data[2]).toBe(255)
      expect(result.data[3]).toBe(255)
    })

    it('devrait gérer les valeurs par défaut pour les paramètres optionnels', () => {
      const input = new ImageData(1, 1)
      input.data[0] = 128
      input.data[1] = 128
      input.data[2] = 128
      input.data[3] = 255

      const config = {
        rgb: { r: 1, g: 1, b: 1 },
        brightness: 1,
        contrast: 1,
        saturation: 1
        // Pas de hue, vibrance, temperature, etc.
      }

      const result = applyAdjustmentsInOnePass(input, config as any)

      expect(result).toBeInstanceOf(ImageData)
      expect(result.data.length).toBe(4)
    })
  })

  describe("Fonctions d'ajustement individuelles", () => {
    // Note: Les fonctions helper sont privées, donc on les teste via applyAdjustmentsInOnePass
    // ou on pourrait les exporter si nécessaire pour les tests

    it('devrait appliquer la correction gamma', () => {
      const input = new ImageData(1, 1)
      input.data[0] = 128 // milieu de gamme
      input.data[1] = 128
      input.data[2] = 128
      input.data[3] = 255

      const config = {
        rgb: { r: 1, g: 1, b: 1 },
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        gamma: 2.2, // Gamma élevé = éclaircit les tons moyens
        exposure: 0,
        highlights: 0,
        shadows: 0,
        posterization: 256
      }

      const result = applyAdjustmentsInOnePass(input, config)

      // Avec gamma 2.2, 128 devrait devenir plus clair
      expect(result.data[0]).toBeGreaterThan(128)
      expect(result.data[1]).toBeGreaterThan(128)
      expect(result.data[2]).toBeGreaterThan(128)
    })

    it('devrait appliquer la température de couleur', () => {
      const input = new ImageData(1, 1)
      input.data[0] = 128
      input.data[1] = 128
      input.data[2] = 128
      input.data[3] = 255

      const config = {
        rgb: { r: 1, g: 1, b: 1 },
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        vibrance: 0,
        temperature: 50, // Plus chaud = plus rouge, moins bleu
        tint: 0,
        gamma: 1,
        exposure: 0,
        highlights: 0,
        shadows: 0,
        posterization: 256
      }

      const result = applyAdjustmentsInOnePass(input, config)

      // Température positive devrait augmenter le rouge et diminuer le bleu
      expect(result.data[0]).toBeGreaterThan(result.data[2])
    })

    it('devrait appliquer la teinte', () => {
      const input = new ImageData(1, 1)
      input.data[0] = 128
      input.data[1] = 128
      input.data[2] = 128
      input.data[3] = 255

      const config = {
        rgb: { r: 1, g: 1, b: 1 },
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        vibrance: 0,
        temperature: 0,
        tint: 30, // Teinte magenta = plus vert, moins rouge/bleu
        gamma: 1,
        exposure: 0,
        highlights: 0,
        shadows: 0,
        posterization: 256
      }

      const result = applyAdjustmentsInOnePass(input, config)

      // Teinte positive devrait augmenter le vert
      expect(result.data[1]).toBeGreaterThan(result.data[0])
      expect(result.data[1]).toBeGreaterThan(result.data[2])
    })

    it("devrait appliquer l'exposition", () => {
      const input = new ImageData(1, 1)
      input.data[0] = 64 // valeur sombre
      input.data[1] = 64
      input.data[2] = 64
      input.data[3] = 255

      const config = {
        rgb: { r: 1, g: 1, b: 1 },
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        gamma: 1,
        exposure: 1, // +1 stop = x2
        highlights: 0,
        shadows: 0,
        posterization: 256
      }

      const result = applyAdjustmentsInOnePass(input, config)

      // Exposition +1 devrait doubler les valeurs
      expect(Math.abs(result.data[0] - 128)).toBeLessThan(2)
      expect(Math.abs(result.data[1] - 128)).toBeLessThan(2)
      expect(Math.abs(result.data[2] - 128)).toBeLessThan(2)
    })

    it('devrait appliquer la postérisation', () => {
      const input = new ImageData(1, 1)
      input.data[0] = 100
      input.data[1] = 150
      input.data[2] = 200
      input.data[3] = 255

      const config = {
        rgb: { r: 1, g: 1, b: 1 },
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        gamma: 1,
        exposure: 0,
        highlights: 0,
        shadows: 0,
        posterization: 4 // 4 niveaux = step de 85
      }

      const result = applyAdjustmentsInOnePass(input, config)

      // Avec 4 niveaux, les valeurs devraient être quantifiées
      expect([0, 85, 170, 255]).toContain(result.data[0])
      expect([0, 85, 170, 255]).toContain(result.data[1])
      expect([0, 85, 170, 255]).toContain(result.data[2])
    })
  })
})
