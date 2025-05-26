import { selectContrastedSubset } from '../../src/quant/select-contrast-subset'
import { Vector } from '../../src/type'

const dist = (a: Vector, b: Vector) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

describe('selectContrastedSubset', () => {
  const black: Vector = [0, 0, 0]
  const white: Vector = [255, 255, 255]
  const red: Vector = [255, 0, 0]
  const green: Vector = [0, 255, 0]
  const blue: Vector = [0, 0, 255]

  it('retourne les preselected si leur nombre >= size', () => {
    expect(
      selectContrastedSubset([red, green, blue], [red, green, blue], 2, dist)
    ).toEqual([red, green])
  })

  it('complète les preselected avec les meilleures couleurs', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [red],
      3,
      dist
    )
    expect(result).toContain(red)
    expect(result.length).toBe(3)
  })

  it('inclut toujours toutes les couleurs preselected', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [red, green],
      4,
      dist
    )
    expect(result).toEqual(expect.arrayContaining([red, green]))
    expect(result.length).toBe(4)
  })

  it('préfère un set contenant une couleur sombre et une claire', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [],
      2,
      dist
    )
    expect(result).toEqual(expect.arrayContaining([black, white]))
  })

  it('should return max limit of colors', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [],
      3,
      dist
    )
    expect(result.length).toBe(3)
  })

  it('should return max limit of colors when preselected length equal limit', () => {
    const result = selectContrastedSubset(
      [black, white, red, green, blue],
      [black, white, red],
      3,
      dist
    )
    expect(result.length).toBe(3)
  })
})
