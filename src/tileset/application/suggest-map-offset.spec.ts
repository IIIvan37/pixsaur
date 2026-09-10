import type { Sheet } from '@/libs/pixsaur-tileset'
import { suggestMapOffset } from './suggest-map-offset'

/**
 * 2 x 2 tiles in a checkerboard of two patterns over 3 x 2 cells, laid on the
 * image `shift` pixels from its left edge.
 */
function checkerboardFrom(shift: number): Sheet {
  const width = shift + 3 * 2
  const data = new Uint8ClampedArray(width * 4 * 4)
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const cell = Math.floor((x - shift) / 2) + Math.floor(y / 2)
      data[at] =
        x < shift ? 7 : (cell % 2) * 100 + ((x - shift) % 2) * 10 + (y % 2)
      data[at + 3] = 255
    }
  }
  return { width, height: 4, data }
}

const GRID = { tileWidth: 2, tileHeight: 2 }

describe('suggestMapOffset', () => {
  it('suggests the offset the tiles are laid on', () => {
    expect(suggestMapOffset(checkerboardFrom(1), GRID)?.offsetX).toBe(1)
  })

  it('suggests nothing when the grid already sits on the tiles', () => {
    expect(
      suggestMapOffset(checkerboardFrom(1), { ...GRID, offsetX: 1 })
    ).toBeNull()
  })

  // An offset past one tile lands on the same cut as its remainder.
  it('reads an offset past one tile as its remainder', () => {
    expect(
      suggestMapOffset(checkerboardFrom(1), { ...GRID, offsetX: 3 })
    ).toBeNull()
  })
})
