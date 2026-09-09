import { measureTileGeometry } from './tile-geometry'

const eightBySeven = { x: 8, y: 7 }
const square = { x: 1, y: 1 }
const nesTile = { tileWidth: 8, tileHeight: 8 }
const modeZeroPixel = { x: 2, y: 1 }

describe('measureTileGeometry', () => {
  it('squashes a NES tile drawn with square destination pixels', () => {
    const { distortion } = measureTileGeometry({
      source: nesTile,
      sourcePixel: eightBySeven,
      targetPixel: square,
      target: nesTile
    })

    expect(distortion).toBe(-0.125)
  })

  it('derives the fractional height that would preserve the source shape', () => {
    const { idealHeight } = measureTileGeometry({
      source: nesTile,
      sourcePixel: eightBySeven,
      targetPixel: modeZeroPixel,
      target: { tileWidth: 5, tileHeight: 8 }
    })

    expect(idealHeight).toBe(8.75)
  })

  it('derives the fractional width that would preserve the source shape', () => {
    const { idealWidth } = measureTileGeometry({
      source: nesTile,
      sourcePixel: eightBySeven,
      targetPixel: modeZeroPixel,
      target: { tileWidth: 5, tileHeight: 8.75 }
    })

    expect(idealWidth).toBe(5)
  })

  it('ranks an exactly undistorted size first', () => {
    const { candidates } = measureTileGeometry({
      source: nesTile,
      sourcePixel: eightBySeven,
      targetPixel: modeZeroPixel,
      target: { tileWidth: 5, tileHeight: 8 }
    })

    expect(candidates[0]).toEqual({
      tileWidth: 4,
      tileHeight: 7,
      distortion: 0
    })
  })

  it('keeps the requested size when it already distorts nothing', () => {
    const { candidates } = measureTileGeometry({
      source: nesTile,
      sourcePixel: square,
      targetPixel: square,
      target: nesTile
    })

    expect(candidates[0]).toEqual({
      tileWidth: 8,
      tileHeight: 8,
      distortion: 0
    })
  })

  it('never proposes a tile with no pixels in it', () => {
    const { candidates } = measureTileGeometry({
      source: nesTile,
      sourcePixel: square,
      targetPixel: square,
      target: { tileWidth: 1, tileHeight: 1 }
    })

    expect(
      candidates.every(
        ({ tileWidth, tileHeight }) => tileWidth >= 1 && tileHeight >= 1
      )
    ).toBe(true)
  })
})
