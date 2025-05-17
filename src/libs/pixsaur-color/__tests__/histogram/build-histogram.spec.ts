import { Vector } from '../../src/type'
import { euclideanDistance } from '../../src/metric/distance'
import { buildHistogram } from '../../src/histogram/build-histogram'

describe('buildHistogram', () => {
  it('should count occurrences of mapped colors by index', () => {
    const image: Vector[] = [
      [255, 0, 0], // Rouge → idx 0
      [255, 0, 0], // Rouge
      [0, 255, 0], // Vert  → idx 1
      [0, 0, 255] // Bleu  → nearest is Rouge (tie-breaker idx 0)
    ]

    const palette: Vector[] = [
      [255, 0, 0], // idx 0
      [0, 255, 0] // idx 1
    ]

    const counts = buildHistogram(image, palette, euclideanDistance)

    // Un compteur par couleur de la palette
    expect(counts.length).toBe(2)

    // Rouge (idx 0) : deux rouges + le bleu mappé → 3
    expect(counts[0]).toBe(3)
    // Vert (idx 1) : un vert
    expect(counts[1]).toBe(1)
  })

  it('throws if palette is empty', () => {
    expect(() => buildHistogram([], [], euclideanDistance)).toThrow(
      'Palette cannot be empty'
    )
  })
})
