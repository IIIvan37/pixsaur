import type { Vector } from '@/libs/pixsaur-color/src/type'
import { positionImage, positionImageForAutoMode } from './positioning'

// The test env mocks the 2d canvas context (see vitest.setup.tsx): drawing is a
// no-op and getImageData returns a correctly-sized blank ImageData. So these
// specs assert the positioning *contract* (identity vs. re-canvas, dimensions),
// not the painted pixels.

const palette: Vector[] = [
  [0, 0, 0],
  [255, 255, 255]
]

describe('positionImage', () => {
  it('returns the same image instance when already at target size', () => {
    const image = new ImageData(4, 4)
    const result = positionImage(image, { width: 4, height: 4 }, palette, {
      center: false
    })
    expect(result).toBe(image)
  })

  it('produces a new image at the target dimensions when resizing', () => {
    const image = new ImageData(2, 2)
    const result = positionImage(image, { width: 8, height: 6 }, palette, {
      center: true
    })
    expect(result).not.toBe(image)
    expect(result.width).toBe(8)
    expect(result.height).toBe(6)
  })

  it('positions without centering as well', () => {
    const image = new ImageData(2, 2)
    const result = positionImage(image, { width: 8, height: 6 }, palette, {
      center: false
    })
    expect(result.width).toBe(8)
    expect(result.height).toBe(6)
  })

  it('accepts an explicit background color without throwing', () => {
    const image = new ImageData(2, 2)
    const result = positionImage(image, { width: 8, height: 6 }, palette, {
      center: true,
      backgroundColor: [255, 0, 0]
    })
    expect(result.width).toBe(8)
    expect(result.height).toBe(6)
  })
})

describe('positionImageForAutoMode', () => {
  it('positions to the mode-config dimensions', () => {
    const image = new ImageData(2, 2)
    const result = positionImageForAutoMode(
      image,
      { width: 16, height: 10 },
      palette,
      true
    )
    expect(result.width).toBe(16)
    expect(result.height).toBe(10)
  })

  it('returns the image unchanged when it already matches the mode size', () => {
    const image = new ImageData(16, 10)
    const result = positionImageForAutoMode(
      image,
      { width: 16, height: 10 },
      palette,
      false
    )
    expect(result).toBe(image)
  })
})
