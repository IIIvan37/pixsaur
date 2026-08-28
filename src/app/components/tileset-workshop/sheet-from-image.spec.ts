import { sheetFromImage } from './sheet-from-image'

/** A decoded image of a given natural size — what the uploader hands over. */
function imageOf(width: number, height: number): HTMLImageElement {
  const img = new Image()
  Object.defineProperty(img, 'naturalWidth', { value: width })
  Object.defineProperty(img, 'naturalHeight', { value: height })
  return img
}

describe('sheetFromImage', () => {
  it('keeps the sheet at the size the file came in', () => {
    expect(sheetFromImage(imageOf(320, 240)).width).toBe(320)
  })

  it('carries four bytes for every pixel of the sheet', () => {
    expect(sheetFromImage(imageOf(16, 8)).data).toHaveLength(16 * 8 * 4)
  })
})
