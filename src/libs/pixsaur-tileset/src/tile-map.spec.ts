import { buildTileMap } from './tile-map'

const A = [1, 1]
const B = [2, 2]
const C = [3, 3]

describe('buildTileMap', () => {
  it('gives each cell the index of the tile it shows', () => {
    expect(buildTileMap([A, B, A]).cells).toEqual([0, 1, 0])
  })

  it('numbers the tiles in order of first appearance', () => {
    expect(buildTileMap([A, B, A, C]).cells).toEqual([0, 1, 0, 2])
  })

  it('keeps each distinct tile once, at the cell it first appears in', () => {
    expect(buildTileMap([A, B, A, C]).tiles).toEqual([0, 1, 3])
  })
})
