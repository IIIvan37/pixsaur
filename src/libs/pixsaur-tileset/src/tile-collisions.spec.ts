import { rankTileCollisions } from './tile-collisions'

describe('rankTileCollisions', () => {
  it('gives a tile the mean error of its pixels', () => {
    expect(rankTileCollisions([[0, 1]], [0], [0, 4])).toEqual([
      { tile: 0, error: 2 }
    ])
  })

  it('ranks the worst tile first', () => {
    expect(rankTileCollisions([[0], [1]], [0, 1], [0, 4])[0].tile).toBe(1)
  })

  it('leaves the pixels carrying no colour out of the mean', () => {
    expect(
      rankTileCollisions([[1, 9]], [0], [0, 4], { ignore: 9 })[0].error
    ).toBe(4)
  })

  it('blames a tile made only of holes for nothing', () => {
    expect(
      rankTileCollisions([[9, 9]], [0], [0, 4], { ignore: 9 })[0].error
    ).toBe(0)
  })
})
