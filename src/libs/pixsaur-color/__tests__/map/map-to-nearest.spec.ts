import { Vector } from '../../src/type'
import {
  cie76Distance,
  deltaE2000,
  euclideanDistance
} from '../../src/metric/distance'
import { mapToNearest } from '../../src/map'

describe('mapToNearest', () => {
  const palette: Vector[] = [
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255]
  ]

  it('choisit la couleur la plus proche en euclidienne RGB', () => {
    const color: Vector = [250, 10, 10] // très proche du rouge
    const nearest = mapToNearest(color, palette, euclideanDistance)
    expect(nearest).toEqual([255, 0, 0])
  })

  it('fonctionne aussi avec cie76Distance en Lab', () => {
    // même palette, mais on compare avec cie76 (sur des valeurs rgb↔lab internes)
    const color: Vector = [10, 250, 10] // très proche du vert
    const nearest = mapToNearest(color, palette, cie76Distance)
    expect(nearest).toEqual([0, 255, 0])
  })

  it('respecte deltaE2000 pour une couleur intermédiaire', () => {
    // milieu entre rouge et vert
    const color: Vector = [128, 128, 0]
    const nearest = mapToNearest(color, palette, deltaE2000)
    // en pratique ΔE2000 juge le rouge plus proche que le vert ici
    expect(nearest).toEqual([255, 0, 0])
  })

  it('lance une erreur si la palette est vide', () => {
    expect(() => mapToNearest([10, 10, 10], [], euclideanDistance)).toThrow(
      'Palette cannot be empty'
    )
  })
})
