import { suggestTileGeometry } from './suggest-tile-geometry'

/** Square source pixels — a PC or Game Boy sheet. */
const square = { x: 1, y: 1 }
const nesNtsc = { x: 8, y: 7 }

describe('suggestTileGeometry', () => {
  it('reports no distortion when the destination keeps the source shape', () => {
    const geometry = suggestTileGeometry({
      source: { tileWidth: 8, tileHeight: 8 },
      sourcePixel: square,
      mode: 1,
      target: { tileWidth: 8, tileHeight: 8 }
    })

    expect(geometry.distortion).toBe(0)
  })

  it('counts a mode 0 pixel as twice as wide as it is tall', () => {
    const geometry = suggestTileGeometry({
      source: { tileWidth: 8, tileHeight: 8 },
      sourcePixel: square,
      mode: 0,
      target: { tileWidth: 8, tileHeight: 8 }
    })

    expect(geometry.distortion).toBe(1)
  })

  it('derives the fractional height a NES tile would want in mode 0', () => {
    const geometry = suggestTileGeometry({
      source: { tileWidth: 8, tileHeight: 8 },
      sourcePixel: nesNtsc,
      mode: 0,
      target: { tileWidth: 5, tileHeight: 8 }
    })

    expect(geometry.idealHeight).toBe(8.75)
  })

  it('derives the width a NES tile would want for a pinned height', () => {
    const geometry = suggestTileGeometry({
      source: { tileWidth: 8, tileHeight: 8 },
      sourcePixel: nesNtsc,
      mode: 0,
      target: { tileWidth: 5, tileHeight: 7 }
    })

    expect(geometry.idealWidth).toBe(4)
  })

  it('offers the whole-pixel size that would distort nothing', () => {
    const geometry = suggestTileGeometry({
      source: { tileWidth: 8, tileHeight: 8 },
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
