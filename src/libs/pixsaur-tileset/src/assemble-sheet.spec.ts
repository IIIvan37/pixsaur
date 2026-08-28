import { assembleSheet, scaleSheetGutters } from './assemble-sheet'

const NONE = {
  leadingX: 0,
  leadingY: 0,
  trailingX: 0,
  trailingY: 0,
  gapX: 0,
  gapY: 0
}

const FLAT = { x: 1, y: 1 }

/** `count` tiles of `size` x `size`, tile `n` painted uniformly with pen `n`. */
const tilesOf = (count: number, size: number) =>
  Array.from({ length: count }, (_, at) =>
    new Uint8Array(size * size).fill(at + 1)
  )

describe('scaleSheetGutters', () => {
  const source = { tileWidth: 16, tileHeight: 16, margin: 4, spacing: 2 }

  it('halves a gap when the tile is halved', () => {
    const gutters = scaleSheetGutters(source, {
      tileWidth: 8,
      tileHeight: 16
    })

    expect(gutters.gapX).toBe(1)
  })

  it('leaves a gap alone when the tile keeps its size', () => {
    const gutters = scaleSheetGutters(source, {
      tileWidth: 16,
      tileHeight: 16
    })

    expect(gutters.gapY).toBe(2)
  })

  it('keeps a one-pixel gap that halving would otherwise erase', () => {
    const gutters = scaleSheetGutters(
      { tileWidth: 16, tileHeight: 16, spacing: 1 },
      { tileWidth: 8, tileHeight: 8 }
    )

    expect(gutters.gapX).toBe(1)
  })

  it('counts the grid offset into the blank before the first tile', () => {
    const gutters = scaleSheetGutters(
      { tileWidth: 8, tileHeight: 8, margin: 2, offsetX: 3 },
      { tileWidth: 8, tileHeight: 8 }
    )

    expect(gutters.leadingX).toBe(5)
  })

  it('leaves the far side of the sheet the margin alone', () => {
    const gutters = scaleSheetGutters(
      { tileWidth: 8, tileHeight: 8, margin: 2, offsetX: 3 },
      { tileWidth: 8, tileHeight: 8 }
    )

    expect(gutters.trailingX).toBe(2)
  })
})

describe('assembleSheet', () => {
  it('packs the tiles tight when the source declared no gutter', () => {
    const sheet = assembleSheet(tilesOf(2, 4), {
      columns: 2,
      rows: 1,
      tile: { tileWidth: 4, tileHeight: 4 },
      gutters: NONE,
      stretch: FLAT,
      fill: 0
    })

    expect(sheet.width).toBe(8)
  })

  it('makes room for the gutters the source declared', () => {
    const sheet = assembleSheet(tilesOf(2, 4), {
      columns: 2,
      rows: 1,
      tile: { tileWidth: 4, tileHeight: 4 },
      gutters: { ...NONE, leadingX: 1, trailingX: 1, gapX: 2 },
      stretch: FLAT,
      fill: 0
    })

    expect(sheet.width).toBe(12)
  })

  it('lays the second tile after the gap, not against the first', () => {
    const sheet = assembleSheet(tilesOf(2, 4), {
      columns: 2,
      rows: 1,
      tile: { tileWidth: 4, tileHeight: 4 },
      gutters: { ...NONE, gapX: 2 },
      stretch: FLAT,
      fill: 0
    })

    expect(sheet.indices[6]).toBe(2)
  })

  it('paints the gutter with the pen it was handed', () => {
    const sheet = assembleSheet(tilesOf(2, 4), {
      columns: 2,
      rows: 1,
      tile: { tileWidth: 4, tileHeight: 4 },
      gutters: { ...NONE, gapX: 2 },
      stretch: FLAT,
      fill: 7
    })

    expect(sheet.indices[4]).toBe(7)
  })

  it('stretches every pixel by the mode the sheet is for', () => {
    const sheet = assembleSheet(tilesOf(1, 4), {
      columns: 1,
      rows: 1,
      tile: { tileWidth: 4, tileHeight: 4 },
      gutters: NONE,
      stretch: { x: 2, y: 1 },
      fill: 0
    })

    expect(sheet.width).toBe(8)
  })

  it('stretches the gutters too, so the grid stays square', () => {
    const sheet = assembleSheet(tilesOf(1, 4), {
      columns: 1,
      rows: 1,
      tile: { tileWidth: 4, tileHeight: 4 },
      gutters: { ...NONE, leadingX: 1 },
      stretch: { x: 2, y: 1 },
      fill: 0
    })

    expect(sheet.width).toBe(10)
  })

  it('stacks the rows down the sheet', () => {
    const sheet = assembleSheet(tilesOf(2, 4), {
      columns: 1,
      rows: 2,
      tile: { tileWidth: 4, tileHeight: 4 },
      gutters: NONE,
      stretch: FLAT,
      fill: 0
    })

    expect(sheet.indices[4 * 4]).toBe(2)
  })
})
