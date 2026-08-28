import { chooseResizeScheme, resizeTileByScheme } from './resize-scheme'
import type { SourceTile, TileGrid } from './slice-sheet'

const eight: TileGrid = { tileWidth: 8, tileHeight: 8 }

/** An 8-row tile whose column `x` is uniformly painted `columns[x]`. */
function tileOfColumns(columns: number[]): SourceTile {
  const width = columns.length
  const data = new Uint8ClampedArray(width * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      data[at] = columns[x]
      data[at + 3] = 255
    }
  }
  return { data }
}

/** The red channel of the tile's first row — one value per column. */
function columnsOf(tile: SourceTile, width: number): number[] {
  return Array.from({ length: width }, (_, x) => tile.data[x * 4])
}

const ALL_ROWS = [0, 1, 2, 3, 4, 5, 6, 7]

describe('resizeTileByScheme', () => {
  it('takes the columns the scheme names, in order', () => {
    const tile = tileOfColumns([0, 10, 20, 30, 40, 50, 60, 70])
    const to: TileGrid = { tileWidth: 3, tileHeight: 8 }

    const resized = resizeTileByScheme(tile, eight, to, {
      columns: [0, 3, 7],
      rows: ALL_ROWS
    })

    expect(columnsOf(resized, 3)).toEqual([0, 30, 70])
  })
})

const SEVEN: TileGrid = { tileWidth: 7, tileHeight: 8 }
const CLAMPED = { horizontal: 'clamp', vertical: 'clamp' } as const
const WRAPPED = { horizontal: 'wrap', vertical: 'clamp' } as const

describe('chooseResizeScheme', () => {
  it('drops a duplicated column, which costs nothing', () => {
    const tile = tileOfColumns([0, 0, 50, 100, 160, 200, 230, 255])

    const scheme = chooseResizeScheme([tile], eight, SEVEN, CLAMPED)

    expect(
      columnsOf(resizeTileByScheme(tile, eight, SEVEN, scheme), 7)
    ).toEqual([0, 50, 100, 160, 200, 230, 255])
  })

  it('drops whichever column is the duplicated one', () => {
    const tile = tileOfColumns([0, 50, 100, 160, 200, 230, 255, 255])

    const scheme = chooseResizeScheme([tile], eight, SEVEN, CLAMPED)

    expect(
      columnsOf(resizeTileByScheme(tile, eight, SEVEN, scheme), 7)
    ).toEqual([0, 50, 100, 160, 200, 230, 255])
  })

  it('picks one scheme for the whole tileset, not one per tile', () => {
    const alone = tileOfColumns([0, 0, 50, 100, 160, 200, 230, 255])
    const others = tileOfColumns([0, 90, 180, 255, 255, 200, 130, 60])

    const scheme = chooseResizeScheme([alone, others], eight, SEVEN, CLAMPED)

    expect(scheme.columns).toEqual([0, 1, 2, 3, 5, 6, 7])
  })

  it('lets a wrapping tile drop its last column against its first', () => {
    const seam = tileOfColumns([10, 200, 60, 150, 90, 240, 120, 10])

    const scheme = chooseResizeScheme([seam], eight, SEVEN, WRAPPED)

    expect(scheme.columns).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('repeats source columns when the destination is the wider one', () => {
    const tile = tileOfColumns([0, 10, 20, 30, 40, 50, 60, 70])
    const twelve: TileGrid = { tileWidth: 12, tileHeight: 8 }

    const scheme = chooseResizeScheme([tile], eight, twelve, CLAMPED)

    expect(scheme.columns).toEqual([0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7])
  })

  it('still drops the duplicates when the axis is too wide to enumerate', () => {
    const distinct = Array.from({ length: 18 }, (_, i) => i * 15)
    const doubled = distinct.flatMap((v, i) => (i < 14 ? [v, v] : [v]))
    const wide: TileGrid = { tileWidth: 32, tileHeight: 8 }
    const narrow: TileGrid = { tileWidth: 18, tileHeight: 8 }
    const tile = tileOfColumns(doubled)

    const scheme = chooseResizeScheme([tile], wide, narrow, CLAMPED)

    expect(
      columnsOf(resizeTileByScheme(tile, wide, narrow, scheme), 18)
    ).toEqual(distinct)
  }, 2000)
})
