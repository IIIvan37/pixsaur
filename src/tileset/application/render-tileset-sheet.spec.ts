import type { ConvertedTileset } from './convert-tileset'
import { renderTilesetSheet } from './render-tileset-sheet'

const RED: [number, number, number] = [255, 0, 0]
const BLUE: [number, number, number] = [0, 0, 255]
const BLACK: [number, number, number] = [0, 0, 0]

/**
 * Two 2 x 2 tiles side by side, pen 1 everywhere in the first, pen 2 in the
 * second. Pen 0 is the hole, so the sheet exercises the three cases at once:
 * an opaque pen, the hole pen, and whatever fills the blanks.
 */
function tilesetOfTwoTiles(
  transparentPen: number | null = 0
): ConvertedTileset {
  return {
    columns: 2,
    rows: 1,
    palette: [BLACK, RED, BLUE],
    tiles: [
      { indices: Uint8Array.from([1, 1, 1, 1]) },
      { indices: Uint8Array.from([2, 2, 2, 2]) }
    ],
    instanceOf: [0, 1],
    unique: [0, 1],
    transparentPen,
    collisions: [],
    resizeSearch: null
  }
}

const render = (tileset: ConvertedTileset, margin = 0, spacing = 0) =>
  renderTilesetSheet(tileset, {
    source: { tileWidth: 4, tileHeight: 4, margin, spacing },
    target: { tileWidth: 2, tileHeight: 2 },
    mode: 0
  })

/** The RGBA quadruplet the sheet carries at `(x, y)`. */
const pixelAt = (
  sheet: ReturnType<typeof render>,
  x: number,
  y: number
): number[] => {
  const at = (y * sheet.width + x) * 4
  return Array.from(sheet.data.subarray(at, at + 4))
}

describe('renderTilesetSheet', () => {
  it('pre-stretches mode 0 pixels so the sheet opens undistorted', () => {
    // 2 tiles x 2 CPC px, doubled horizontally (mode 0 scaleX = 2).
    expect(render(tilesetOfTwoTiles()).width).toBe(8)
  })

  it('leaves the vertical axis alone, mode 0 stretches only horizontally', () => {
    expect(render(tilesetOfTwoTiles()).height).toBe(2)
  })

  it('gives the sheet back the gutters the source grid declared', () => {
    // Halved with the tile: 1 + 2 + 1 + 2 + 1 CPC px, doubled by mode 0.
    expect(render(tilesetOfTwoTiles(), 2, 2).width).toBe(14)
  })

  it('paints a pen with the colour the palette gives it', () => {
    expect(pixelAt(render(tilesetOfTwoTiles()), 0, 0)).toEqual([255, 0, 0, 255])
  })

  it('paints the second tile with its own pen', () => {
    expect(pixelAt(render(tilesetOfTwoTiles()), 4, 0)).toEqual([0, 0, 255, 255])
  })

  // Alpha 0 is what replaces the PNG `tRNS` chunk: the hole is a pen the
  // canvas simply does not paint.
  it('leaves the transparency pen fully transparent', () => {
    const sheet = render(tilesetOfTwoTiles(), 2, 2)

    expect(pixelAt(sheet, 0, 0)[3]).toBe(0)
  })

  it('fills the blanks with the pen nearest the background when no pen holds the hole', () => {
    const sheet = render(tilesetOfTwoTiles(null), 2, 2)

    expect(pixelAt(sheet, 0, 0)).toEqual([0, 0, 0, 255])
  })
})
