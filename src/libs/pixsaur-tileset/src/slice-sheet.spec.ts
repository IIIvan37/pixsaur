import { type Sheet, sliceSheet } from './slice-sheet'

/** A sheet whose every pixel encodes its own x coordinate in the red channel. */
function rulerSheet(width: number, height: number): Sheet {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = x
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

describe('sliceSheet', () => {
  it('keeps the tiles a grid covers and leaves the leftover strip', () => {
    const sliced = sliceSheet(rulerSheet(20, 8), {
      tileWidth: 8,
      tileHeight: 8
    })

    expect(sliced?.columns).toBe(2)
  })

  it('shifts the whole grid by the offset', () => {
    const sliced = sliceSheet(rulerSheet(16, 8), {
      tileWidth: 8,
      tileHeight: 8,
      offsetX: 3
    })

    expect(sliced?.tiles[0].data[0]).toBe(3)
  })

  it('counts the margin on both sides of the sheet', () => {
    const sliced = sliceSheet(rulerSheet(17, 10), {
      tileWidth: 8,
      tileHeight: 8,
      margin: 1
    })

    expect(sliced?.columns).toBe(1)
  })

  it('leaves the spacing between two tiles unsliced', () => {
    const sliced = sliceSheet(rulerSheet(18, 8), {
      tileWidth: 8,
      tileHeight: 8,
      spacing: 2
    })

    expect(sliced?.tiles[1].data[0]).toBe(10)
  })

  it('rejects a grid no whole tile fits', () => {
    expect(sliceSheet(rulerSheet(4, 4), { tileWidth: 8, tileHeight: 8 })).toBe(
      null
    )
  })
})
