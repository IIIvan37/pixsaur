import type { ConvertedTileset } from './convert-tileset'
import { mapTileset } from './tileset-map'

/** A tileset whose tiles hold the given pen, one pen per tile. */
function tilesetOf(pens: number[], columns = pens.length): ConvertedTileset {
  return {
    columns,
    rows: pens.length / columns,
    palette: [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0]
    ],
    tiles: pens.map((pen) => ({ indices: new Uint8Array(4).fill(pen) })),
    // Left as the conversion found them: the map must not trust it.
    instanceOf: pens.map((_, at) => at),
    unique: pens.map((_, at) => at),
    transparentPen: null,
    collisions: [],
    resizeSearch: null
  }
}

describe('mapTileset', () => {
  it('lays the cells on the columns of the source grid', () => {
    expect(
      mapTileset(tilesetOf([0, 1, 0, 1], 2), { budget: 256 }).columns
    ).toBe(2)
  })

  it('lays the cells on the rows of the source grid', () => {
    expect(mapTileset(tilesetOf([0, 1, 0, 1], 2), { budget: 256 }).rows).toBe(2)
  })

  // M-Q18: the edit layer is replayed before the deduplication, so two tiles
  // a stroke made identical are one tile of the map.
  it('deduplicates the tiles as the workshop shows them', () => {
    expect(mapTileset(tilesetOf([1, 1]), { budget: 256 }).tiles).toEqual([0])
  })

  it('flags a map that keeps more tiles than the budget', () => {
    expect(mapTileset(tilesetOf([0, 1, 2]), { budget: 2 }).overBudget).toBe(
      true
    )
  })

  it('accepts a map that meets its budget exactly', () => {
    expect(mapTileset(tilesetOf([0, 1]), { budget: 2 }).overBudget).toBe(false)
  })
})
