import { suggestTileGeometry } from './suggest-tile-geometry'

/** Square source pixels — a PC or Game Boy sheet. */
const square = { x: 1, y: 1 }
const nesNtsc = { x: 8, y: 7 }
const eightSquare = { tileWidth: 8, tileHeight: 8 }

describe('suggestTileGeometry', () => {
  it('counts a mode 1 pixel as square', () => {
    const geometry = suggestTileGeometry({
      source: eightSquare,
      sourcePixel: square,
      mode: 1,
      target: eightSquare
    })

    expect(geometry.distortion).toBe(0)
  })

  it('counts a mode 0 pixel as twice as wide as it is tall', () => {
    const geometry = suggestTileGeometry({
      source: eightSquare,
      sourcePixel: square,
      mode: 0,
      target: eightSquare
    })

    expect(geometry.distortion).toBe(1)
  })

  it('hands back the sizes measured against that CPC pixel', () => {
    const geometry = suggestTileGeometry({
      source: eightSquare,
      sourcePixel: nesNtsc,
      mode: 0,
      target: { tileWidth: 5, tileHeight: 8 }
    })

    expect(geometry.candidates[0]).toEqual({
      tileWidth: 4,
      tileHeight: 7,
      distortion: 0
    })
  })
})
