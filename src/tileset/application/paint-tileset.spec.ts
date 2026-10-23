import type { ConvertedTileset } from './convert-tileset'
import {
  applyTilesetEdits,
  EMPTY_EDIT_LAYER,
  type PaintTilesetInput,
  paintTileset,
  type TilesetEditLayer
} from './paint-tileset'

const SHAPE = { tileWidth: 2, tileHeight: 2 }

/** A tileset of 2 x 2 tiles, given as flat runs of pen indices. */
function tilesetOf(tiles: number[][], instanceOf: number[]): ConvertedTileset {
  return {
    columns: tiles.length,
    rows: 1,
    palette: [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0]
    ],
    tiles: tiles.map((indices) => ({ indices: Uint8Array.from(indices) })),
    instanceOf,
    unique: [...new Set(instanceOf)],
    transparentPen: 0,
    resizeSearch: null
  }
}

/** Tiles 0 and 2 are one tile; tile 1 stands alone. */
const TWINS = tilesetOf(
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0]
  ],
  [0, 1, 0]
)

function paint(over: Partial<PaintTilesetInput> = {}): TilesetEditLayer {
  return paintTileset({
    tileset: TWINS,
    shape: SHAPE,
    layer: EMPTY_EDIT_LAYER,
    tile: 0,
    pixels: [{ x: 1, y: 0 }],
    pen: 2,
    ...over
  })
}

describe('paintTileset', () => {
  it('writes the pen over every instance of the tile', () => {
    expect(paint()).toEqual({ 0: { 1: 2 }, 2: { 1: 2 } })
  })

  it('records nothing when the pixel already holds the pen', () => {
    expect(paint({ tile: 1, pen: 1 })).toBe(EMPTY_EDIT_LAYER)
  })

  it('refuses a pen the frozen palette has not got', () => {
    expect(paint({ pen: 7 })).toBe(EMPTY_EDIT_LAYER)
  })

  it('refuses a pixel outside the tile', () => {
    expect(paint({ pixels: [{ x: 2, y: 0 }] })).toBe(EMPTY_EDIT_LAYER)
  })

  it('keeps what an earlier stroke painted elsewhere on the tile', () => {
    const first = paint({ pixels: [{ x: 0, y: 1 }] })

    expect(paint({ layer: first })[0]).toEqual({ 1: 2, 2: 2 })
  })

  it('lets a later stroke win on the same pixel', () => {
    const red = paint({ pen: 1 })

    expect(paint({ layer: red, pen: 2 })[0]).toEqual({ 1: 2 })
  })

  it('keeps the first retouch however many follow', () => {
    let layer = paint({ tile: 1, pixels: [{ x: 0, y: 0 }], pen: 0 })
    for (let stroke = 0; stroke < 150; stroke++) {
      layer = paint({ layer, pen: stroke % 2 === 0 ? 1 : 2 })
    }

    expect(layer[1]).toEqual({ 0: 0 })
  })
})

describe('applyTilesetEdits', () => {
  const painted = paint()

  it('lays the pens over every instance of the tile', () => {
    const edited = applyTilesetEdits(TWINS, painted)

    expect([...edited.tiles[2].indices]).toEqual([0, 2, 0, 0])
  })

  it('leaves the tiles outside the group untouched', () => {
    const edited = applyTilesetEdits(TWINS, painted)

    expect([...edited.tiles[1].indices]).toEqual([1, 1, 1, 1])
  })

  it('never writes into the conversion it was handed', () => {
    applyTilesetEdits(TWINS, painted)

    expect([...TWINS.tiles[0].indices]).toEqual([0, 0, 0, 0])
  })

  it('skips a position the sheet no longer has', () => {
    const edited = applyTilesetEdits(TWINS, { 9: { 0: 1 } })

    expect(edited.tiles).toHaveLength(3)
  })

  it('hands back the sheet itself when nothing is painted', () => {
    expect(applyTilesetEdits(TWINS, EMPTY_EDIT_LAYER)).toBe(TWINS)
  })
})
