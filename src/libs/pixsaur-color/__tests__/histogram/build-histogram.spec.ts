import {

  buildWeightedHistogram
} from '../../src/histogram/build-histogram'
import { euclideanDistance } from '../../src/metric/distance'
import type { Vector } from '../../src/type'


describe('buildWeightedHistogram', () => {
  it('should weight pixel contributions based on distance to palette colors', () => {
    const image: Vector[] = [
      [255, 0, 0], // Exact match with red
      [0, 255, 0], // Exact match with green
      [128, 0, 0] // Half red - should contribute to red but with lower weight
    ]

    const palette: Vector[] = [
      [255, 0, 0], // idx 0 - red
      [0, 255, 0] // idx 1 - green
    ]

    const counts = buildWeightedHistogram(image, palette, euclideanDistance)

    expect(counts.length).toBe(2)
    expect(counts[0]).toBeGreaterThan(1) // Red gets full weight from first pixel + partial from third
    expect(counts[1]).toBeGreaterThan(1) // Green gets full weight from second pixel
    expect(counts[0] + counts[1]).toBeCloseTo(3, 1) // Total weight should be approximately 3
  })

  it('should handle perfect matches correctly', () => {
    const image: Vector[] = [
      [255, 0, 0] // Exact match
    ]

    const palette: Vector[] = [
      [255, 0, 0], // idx 0
      [0, 255, 0] // idx 1
    ]

    const counts = buildWeightedHistogram(image, palette, euclideanDistance)

    expect(counts[0]).toBe(1) // All weight goes to perfect match
    expect(counts[1]).toBe(0) // No weight to other colors
  })

  it('throws if palette is empty', () => {
    expect(() => buildWeightedHistogram([], [], euclideanDistance)).toThrow(
      'Palette cannot be empty'
    )
  })

  it('should detect blue colors in CPC palette with weighted histogram', () => {
    // Image avec des pixels bleus
    const image: Vector[] = [
      [0, 0, 255], // Bleu pur
      [0, 0, 200], // Bleu foncé
      [0, 0, 128], // Bleu moyen
      [0, 0, 64], // Bleu sombre
      [255, 255, 255] // Blanc pour contraste
    ]

    // Palette CPC Classic avec les couleurs bleues
    const palette: Vector[] = [
      [0, 0, 0], // Noir
      [0, 0, 128], // Bleu sombre (idx 1)
      [0, 0, 255], // Bleu (idx 2)
      [0, 128, 0], // Vert
      [128, 0, 0], // Rouge
      [128, 0, 128], // Magenta
      [255, 128, 0], // Orange
      [128, 128, 0], // Jaune
      [0, 128, 128], // Cyan
      [128, 128, 128], // Gris
      [64, 64, 64], // Gris foncé
      [0, 64, 128], // Bleu-vert (idx 11)
      [128, 0, 64], // Rose
      [64, 0, 128], // Violet
      [0, 128, 64], // Vert-bleu (idx 14)
      [128, 64, 0], // Marron
      [64, 128, 0], // Vert-jaune
      [0, 64, 64], // Cyan foncé
      [64, 0, 64], // Magenta foncé
      [128, 128, 64], // Jaune-vert
      [0, 0, 64], // Bleu très sombre (idx 20)
      [64, 64, 128], // Bleu-gris
      [128, 64, 128], // Magenta-gris
      [64, 128, 128], // Cyan-gris
      [128, 128, 128], // Gris clair
      [255, 255, 255] // Blanc
    ]

    const counts = buildWeightedHistogram(image, palette, euclideanDistance)

    // Vérifier que les couleurs bleues ont du poids
    const blueIndices = [1, 2, 11, 14, 20] // Indices des couleurs bleues dans CPC
    const totalBlueWeight = blueIndices.reduce(
      (sum, idx) => sum + counts[idx],
      0
    )

    // Les pixels bleus devraient contribuer principalement aux couleurs bleues
    expect(totalBlueWeight).toBeGreaterThan(3) // Au moins 3 unités de poids pour les bleus

    // Vérifier que les couleurs bleues spécifiques ont du poids
    expect(counts[1]).toBeGreaterThan(0) // Bleu sombre
    expect(counts[2]).toBeGreaterThan(0) // Bleu
    expect(counts[20]).toBeGreaterThan(0) // Bleu très sombre
  })
})
