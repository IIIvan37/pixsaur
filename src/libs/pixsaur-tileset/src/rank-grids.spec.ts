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

/** A 32 × 32 sheet of 8 × 8 tiles, every tile a horizontal ramp. */
function rampSheet(): Sheet {
  const size = 32
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      data[i] = x % 8
      data[i + 3] = 255
    }
  }
  return { width: size, height: size, data }
}

const eight = { tileWidth: 8, tileHeight: 8 }
const sixteen = { tileWidth: 16, tileHeight: 8 }

describe('rankTileGrids', () => {
  const sheet = sheetOfTiles([RAMP, FLAT, RAMP, RAMP])

  it('ranks the tile size that repeats the most first', () => {
    const ranked = rankTileGrids({ sheet, sizes: [sixteen, eight] })

    expect(ranked[0].grid).toEqual(eight)
  })

  it('repeats nothing once the grid is shifted off the tiles', () => {
    const striped = sheetOfTiles([RAMP, FLAT, RAMP, FLAT])
    const shifted = rankTileGrids({
      sheet: striped,
      blanks: { offsetX: 4 },
      sizes: [eight]
    })
    const aligned = rankTileGrids({ sheet: striped, sizes: [eight] })

    expect(shifted[0].duplicateRate).toBeLessThan(aligned[0].duplicateRate)
  })

  it('drops a grid no whole tile fits', () => {
    const ranked = rankTileGrids({
      sheet,
      sizes: [{ tileWidth: 64, tileHeight: 64 }]
    })

    expect(ranked).toEqual([])
  })

  it('reports the duplicate rate, still just as it stands at a fixed size', () => {
    const ranked = rankTileGrids({ sheet, sizes: [eight] })

    expect(ranked[0].duplicateRate).toBeCloseTo(0.5)
  })

  it('charges the unique tiles and one index per position', () => {
    const ranked = rankTileGrids({ sheet, sizes: [eight] })

    // 2 unique tiles of 64 px, 4 positions, over the 32 x 8 they cover.
    expect(ranked[0].tilemapCost).toBeCloseTo((2 * 64 + 4) / (4 * 64))
  })

  it('makes the smaller tile pay the index table it imposes', () => {
    const paired = sheetOfTiles([RAMP, FLAT, RAMP, FLAT])
    const ranked = rankTileGrids({ sheet: paired, sizes: [eight, sixteen] })

    const costOf = (width: number) =>
      ranked.find((c) => c.grid.tileWidth === width)?.tilemapCost ?? 0

    expect(costOf(8)).toBeGreaterThan(costOf(16))
  })

  it('tries the usual tileset divisors when the caller names none', () => {
    const ranked = rankTileGrids({ sheet: rampSheet() })

    expect(ranked.length).toBe(4)
  })

  it('keeps the blanks the user declared on every candidate', () => {
    const ranked = rankTileGrids({
      sheet: rampSheet(),
      blanks: { margin: 2, spacing: 1 }
    })

    expect(ranked.every(({ grid }) => grid.margin === 2)).toBe(true)
  })
})
