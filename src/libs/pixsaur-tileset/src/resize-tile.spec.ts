import { resizeTileNearest } from './resize-tile'
import type { SourceTile } from './slice-sheet'

/** A 2×1 RGBA tile: left pixel red, right pixel blue. */
const redThenBlue: SourceTile = {
  data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
}

describe('resizeTileNearest', () => {
  it('keeps the left-hand colour when halving the width', () => {
    const resized = resizeTileNearest(
      redThenBlue,
      { tileWidth: 2, tileHeight: 1 },
      { tileWidth: 1, tileHeight: 1 }
    )

    expect(Array.from(resized.data)).toEqual([255, 0, 0, 255])
  })
})
