import { mergeNearTiles } from './merge-near-tiles'

/** A tile of one number; two tiles are as far apart as their numbers. */
const tile = (value: number) => [value]
const distance = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Math.abs(a[0] - b[0])

describe('mergeNearTiles', () => {
  it('merges nothing at a threshold of zero', () => {
    expect(
      mergeNearTiles({
        tiles: [tile(0), tile(1)],
        frequencies: [1, 1],
        distance,
        threshold: 0
      })
    ).toEqual([])
  })

  it('merges a tile into a near one', () => {
    expect(
      mergeNearTiles({
        tiles: [tile(0), tile(3)],
        frequencies: [5, 1],
        distance,
        threshold: 4
      })
    ).toEqual([{ absorbed: 1, survivor: 0, distance: 3 }])
  })

  // M-Q15: the tile that stays is the one the map shows most.
  it('keeps the more frequent tile of the two', () => {
    expect(
      mergeNearTiles({
        tiles: [tile(0), tile(3)],
        frequencies: [1, 5],
        distance,
        threshold: 4
      })
    ).toEqual([{ absorbed: 0, survivor: 1, distance: 3 }])
  })

  it('keeps the first seen of two tiles shown as often', () => {
    expect(
      mergeNearTiles({
        tiles: [tile(0), tile(3)],
        frequencies: [2, 2],
        distance,
        threshold: 4
      })
    ).toEqual([{ absorbed: 1, survivor: 0, distance: 3 }])
  })

  it('leaves a tile past the threshold alone', () => {
    expect(
      mergeNearTiles({
        tiles: [tile(0), tile(3)],
        frequencies: [5, 1],
        distance,
        threshold: 2
      })
    ).toEqual([])
  })

  it('never joins a pair the user kept apart, in either order', () => {
    expect(
      mergeNearTiles({
        tiles: [tile(0), tile(3)],
        frequencies: [5, 1],
        distance,
        threshold: 4,
        excluded: [[1, 0]]
      })
    ).toEqual([])
  })

  it('joins a tile to the nearest of the tiles that stay', () => {
    expect(
      mergeNearTiles({
        tiles: [tile(0), tile(10), tile(8)],
        frequencies: [5, 4, 1],
        distance,
        threshold: 9
      })
    ).toEqual([{ absorbed: 2, survivor: 1, distance: 2 }])
  })

  // Otherwise a chain of small steps could carry a tile far from the one it
  // ends up drawn as.
  it('never joins a tile to one already absorbed', () => {
    expect(
      mergeNearTiles({
        tiles: [tile(0), tile(3), tile(6)],
        frequencies: [3, 2, 1],
        distance,
        threshold: 4
      })
    ).toEqual([{ absorbed: 1, survivor: 0, distance: 3 }])
  })
})
