import type { SuggestTileGridInput } from './suggest-tile-grid'
import { suggestTileGrid } from './suggest-tile-grid'

/** A 32 × 32 sheet of 8 × 8 tiles, every tile a horizontal ramp. */
function rampSheet(): SuggestTileGridInput['sheet'] {
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

describe('suggestTileGrid', () => {
  it('tries the usual tileset divisors when the caller names none', () => {
    const suggestions = suggestTileGrid({ sheet: rampSheet() })

    expect(suggestions.length).toBe(4)
  })

  it('ranks the size that repeats the most tiles first', () => {
    const suggestions = suggestTileGrid({ sheet: rampSheet() })

    expect(suggestions[0].grid.tileWidth).toBe(8)
  })

  it('keeps the blanks the user declared on every candidate', () => {
    const suggestions = suggestTileGrid({
      sheet: rampSheet(),
      blanks: { margin: 2, spacing: 1 }
    })

    expect(suggestions.every(({ grid }) => grid.margin === 2)).toBe(true)
  })

  it('tries only the sizes the caller asked for', () => {
    const suggestions = suggestTileGrid({
      sheet: rampSheet(),
      sizes: [{ tileWidth: 16, tileHeight: 16 }]
    })

    expect(suggestions.map(({ grid }) => grid.tileWidth)).toEqual([16])
  })
})
