import type { ConvertedTileset } from './convert-tileset'
import { EMPTY_CELL, mapTileset } from './tileset-map'

/** A tileset whose tiles hold the given pen, one pen per tile. */
function tilesetOf(
  pens: number[],
  columns = pens.length,
  transparentPen: number | null = null
): ConvertedTileset {
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
    transparentPen,
    collisions: [],
    resizeSearch: null
  }
}

describe('mapTileset, empty tile', () => {
  it('leaves every cell a tile while none is to be empty', () => {
    expect(
      mapTileset(tilesetOf([0, 1, 0]), { budget: 256, emptyTile: null }).cells
    ).toEqual([0, 1, 0])
  })

  // M-Q13: the user names a cell, and the tile it shows becomes GID 0.
  it('empties every cell that shows the tile of the cell chosen', () => {
    expect(
      mapTileset(tilesetOf([1, 0, 1]), { budget: 256, emptyTile: 0 }).cells
    ).toEqual([EMPTY_CELL, 0, EMPTY_CELL])
  })

  it('keeps the empty tile out of the tiles the map exports', () => {
    expect(
      mapTileset(tilesetOf([1, 0, 1]), { budget: 256, emptyTile: 0 }).tiles
    ).toEqual([1])
  })

  it('renumbers the tiles that came after the empty one', () => {
    expect(
      mapTileset(tilesetOf([0, 1, 2]), { budget: 256, emptyTile: 0 }).cells
    ).toEqual([EMPTY_CELL, 0, 1])
  })

  it('empties the tile made of holes only, unless told otherwise', () => {
    expect(
      mapTileset(tilesetOf([0, 1], 2, 0), { budget: 256, emptyTile: 'auto' })
        .cells
    ).toEqual([EMPTY_CELL, 0])
  })

  it('finds no tile of holes when alpha was flattened', () => {
    expect(
      mapTileset(tilesetOf([0, 1]), { budget: 256, emptyTile: 'auto' }).cells
    ).toEqual([0, 1])
  })

  it('leaves the empty tile out of the budget', () => {
    expect(
      mapTileset(tilesetOf([0, 1, 2]), { budget: 2, emptyTile: 0 }).overBudget
    ).toBe(false)
  })
})

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
