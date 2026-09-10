import { rankTileOffsets } from './rank-tile-offsets'
import type { Sheet } from './slice-sheet'

/**
 * A map of 2 x 2 tiles, alternating two patterns over 4 x 2 cells, laid on
 * the image one pixel from its left edge. Every pixel of a pattern has its
 * own colour, so a grid off the tiles cuts cells no other cell matches.
 */
function mapShiftedByOnePixel(): Sheet {
  const tile = 2
  const width = 1 + 4 * tile
  const height = 2 * tile
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      if (x === 0) {
        data[at + 2] = 255
      } else {
        const cell = Math.floor((x - 1) / tile) + Math.floor(y / tile)
        data[at] = (cell % 2) * 100 + ((x - 1) % tile) * 10 + (y % tile)
      }
      data[at + 3] = 255
    }
  }
  return { width, height, data }
}

const TILE = { tileWidth: 2, tileHeight: 2 }

describe('rankTileOffsets', () => {
  it('puts first the offset the tiles are laid on', () => {
    const [best] = rankTileOffsets({
      sheet: mapShiftedByOnePixel(),
      tile: TILE
    })

    expect([best.offsetX, best.offsetY]).toEqual([1, 0])
  })

  it('counts the distinct tiles the best offset leaves', () => {
    const [best] = rankTileOffsets({
      sheet: mapShiftedByOnePixel(),
      tile: TILE
    })

    expect(best.uniqueTiles).toBe(2)
  })

  it('tries every offset within one tile', () => {
    expect(
      rankTileOffsets({ sheet: mapShiftedByOnePixel(), tile: TILE })
    ).toHaveLength(4)
  })
})
