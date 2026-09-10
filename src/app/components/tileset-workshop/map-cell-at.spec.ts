import { cellAt } from './map-cell-at'

/** The image as the page lays it out: 30 x 20 px, 10 px from the left. */
const RECT = { left: 10, top: 20, width: 30, height: 20 }
const GRID = { columns: 3, rows: 2 }

describe('cellAt', () => {
  it('names the cell under the pointer', () => {
    expect(cellAt({ x: 25, y: 25 }, RECT, GRID)).toBe(1)
  })

  it('counts the rows above the pointer', () => {
    expect(cellAt({ x: 15, y: 35 }, RECT, GRID)).toBe(3)
  })

  it('names no cell left of the image', () => {
    expect(cellAt({ x: 5, y: 25 }, RECT, GRID)).toBeNull()
  })

  it('names no cell past the right edge of the image', () => {
    expect(cellAt({ x: 40, y: 25 }, RECT, GRID)).toBeNull()
  })

  it('names no cell below the image', () => {
    expect(cellAt({ x: 15, y: 40 }, RECT, GRID)).toBeNull()
  })
})
