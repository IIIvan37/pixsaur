import {
  aspectDistortion,
  candidateTileSizes,
  idealTileHeight,
  idealTileWidth
} from './tile-geometry'

const eightBySeven = { x: 8, y: 7 }
const square = { x: 1, y: 1 }

describe('aspectDistortion', () => {
  it('squashes a NES tile drawn with square destination pixels', () => {
    const distortion = aspectDistortion(
      { tile: { tileWidth: 8, tileHeight: 8 }, pixel: eightBySeven },
      { tile: { tileWidth: 8, tileHeight: 8 }, pixel: square }
    )

    expect(distortion).toBe(-0.125)
  })
})

describe('idealTileHeight', () => {
  it('derives the fractional height that would preserve the source shape', () => {
    const height = idealTileHeight(
      { tile: { tileWidth: 8, tileHeight: 8 }, pixel: eightBySeven },
      { x: 2, y: 1 },
      5
    )

    expect(height).toBe(8.75)
  })
})

describe('idealTileWidth', () => {
  it('derives the fractional width that would preserve the source shape', () => {
    const width = idealTileWidth(
      { tile: { tileWidth: 8, tileHeight: 8 }, pixel: eightBySeven },
      { x: 2, y: 1 },
      8.75
    )

    expect(width).toBe(5)
  })
})

describe('candidateTileSizes', () => {
  const nesTile = {
    tile: { tileWidth: 8, tileHeight: 8 },
    pixel: eightBySeven
  }
  const modeZeroPixel = { x: 2, y: 1 }

  it('ranks an exactly undistorted size first', () => {
    const candidates = candidateTileSizes(nesTile, modeZeroPixel, {
      tileWidth: 5,
      tileHeight: 8
    })

    expect(candidates[0]).toEqual({
      tileWidth: 4,
      tileHeight: 7,
      distortion: 0
    })
  })

  it('keeps the requested size when it already distorts nothing', () => {
    const candidates = candidateTileSizes(
      { tile: { tileWidth: 8, tileHeight: 8 }, pixel: square },
      square,
      { tileWidth: 8, tileHeight: 8 }
    )

    expect(candidates[0]).toEqual({
      tileWidth: 8,
      tileHeight: 8,
      distortion: 0
    })
  })

  it('never proposes a tile with no pixels in it', () => {
    const candidates = candidateTileSizes(
      { tile: { tileWidth: 8, tileHeight: 8 }, pixel: square },
      square,
      { tileWidth: 1, tileHeight: 1 }
    )

    expect(
      candidates.every(
        ({ tileWidth, tileHeight }) => tileWidth >= 1 && tileHeight >= 1
      )
    ).toBe(true)
  })
})
