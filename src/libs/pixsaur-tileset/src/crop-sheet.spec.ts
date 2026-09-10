import { cropSheet } from './crop-sheet'
import type { Sheet } from './slice-sheet'

/** 4 x 2 pixels whose red channel is their position in reading order. */
function numberedSheet(): Sheet {
  const data = new Uint8ClampedArray(4 * 2 * 4)
  for (let at = 0; at < 8; at++) {
    data[at * 4] = at
    data[at * 4 + 3] = 255
  }
  return { width: 4, height: 2, data }
}

describe('cropSheet', () => {
  it('keeps the width asked for', () => {
    expect(
      cropSheet(numberedSheet(), { x: 1, y: 0, width: 2, height: 2 }).width
    ).toBe(2)
  })

  it('keeps the height asked for', () => {
    expect(
      cropSheet(numberedSheet(), { x: 1, y: 1, width: 2, height: 1 }).height
    ).toBe(1)
  })

  it('starts at the corner asked for', () => {
    expect(
      cropSheet(numberedSheet(), { x: 1, y: 1, width: 2, height: 1 }).data[0]
    ).toBe(5)
  })

  it('reads each row of the crop from its own row of the sheet', () => {
    const crop = cropSheet(numberedSheet(), { x: 1, y: 0, width: 2, height: 2 })

    // Second row, first pixel: position 5 of the sheet.
    expect(crop.data[2 * 4]).toBe(5)
  })
})
