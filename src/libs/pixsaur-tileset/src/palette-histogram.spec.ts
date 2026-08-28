import { tilePaletteHistogram } from './palette-histogram'

describe('tilePaletteHistogram', () => {
  it('gives the whole weight to the only colour of a single tile', () => {
    expect(tilePaletteHistogram([[5, 5, 5, 5]])).toEqual([
      { index: 5, frequency: 1 }
    ])
  })

  it('splits a tile weight across the colours it holds', () => {
    expect(tilePaletteHistogram([[1, 1, 2, 2]])).toEqual([
      { index: 1, frequency: 0.5 },
      { index: 2, frequency: 0.5 }
    ])
  })

  it('normalises the weights across the whole tileset', () => {
    expect(
      tilePaletteHistogram([
        [1, 1],
        [2, 2]
      ])
    ).toEqual([
      { index: 1, frequency: 0.5 },
      { index: 2, frequency: 0.5 }
    ])
  })

  it('weighs a repeated tile once, whatever its instance count', () => {
    expect(
      tilePaletteHistogram([
        [1, 1],
        [1, 1],
        [2, 2]
      ])
    ).toEqual([
      { index: 1, frequency: 0.5 },
      { index: 2, frequency: 0.5 }
    ])
  })

  it('lists the heaviest colour first', () => {
    expect(tilePaletteHistogram([[1, 2, 2, 2]])[0].index).toBe(2)
  })

  it('leaves an ignored colour out of the weights', () => {
    expect(tilePaletteHistogram([[1, 1, 9, 9]], { ignore: 9 })).toEqual([
      { index: 1, frequency: 1 }
    ])
  })

  it('drops a tile made only of the ignored colour', () => {
    expect(
      tilePaletteHistogram(
        [
          [9, 9],
          [1, 1]
        ],
        { ignore: 9 }
      )
    ).toEqual([{ index: 1, frequency: 1 }])
  })
})
