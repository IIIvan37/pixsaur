import { rankTileGrids } from './rank-grids'
import type { Sheet } from './slice-sheet'

const RAMP = [0, 1, 2, 3, 4, 5, 6, 7]
const FLAT = [9, 9, 9, 9, 9, 9, 9, 9]

/** One row of 8 × 8 tiles; column `x` of a tile is painted its pattern byte. */
function sheetOfTiles(patterns: number[][]): Sheet {
  const width = patterns.length * 8
  const data = new Uint8ClampedArray(width * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = patterns[Math.floor(x / 8)][x % 8]
      data[i + 3] = 255
    }
  }
  return { width, height: 8, data }
}

const eight = { tileWidth: 8, tileHeight: 8 }
const sixteen = { tileWidth: 16, tileHeight: 8 }

describe('rankTileGrids', () => {
  const sheet = sheetOfTiles([RAMP, FLAT, RAMP, RAMP])

  it('ranks the tile size that repeats the most first', () => {
    const ranked = rankTileGrids(sheet, [sixteen, eight])

    expect(ranked[0].grid).toBe(eight)
  })

  it('ranks a grid shifted off the tiles below the aligned one', () => {
    const striped = sheetOfTiles([RAMP, FLAT, RAMP, FLAT])
    const ranked = rankTileGrids(striped, [{ ...eight, offsetX: 4 }, eight])

    expect(ranked[0].grid).toBe(eight)
  })

  it('drops a grid no whole tile fits', () => {
    const ranked = rankTileGrids(sheet, [{ tileWidth: 64, tileHeight: 64 }])

    expect(ranked).toEqual([])
  })

  it('reports the duplicate rate it ranked on', () => {
    const ranked = rankTileGrids(sheet, [eight])

    expect(ranked[0].duplicateRate).toBeCloseTo(0.5)
  })
})
