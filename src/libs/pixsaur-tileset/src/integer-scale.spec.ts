import { detectIntegerScale, downscaleSheet } from './integer-scale'
import type { Sheet } from './slice-sheet'

/** 3 x 2 pixels, every one a colour of its own. */
function nativeImage(): Sheet {
  const data = new Uint8ClampedArray(3 * 2 * 4)
  for (let at = 0; at < 6; at++) {
    data[at * 4] = at * 40
    data[at * 4 + 1] = 255 - at * 40
    data[at * 4 + 3] = 255
  }
  return { width: 3, height: 2, data }
}

/** Every pixel of `image` drawn as a `factor` x `factor` block. */
function blownUp(image: Sheet, factor: number): Sheet {
  const width = image.width * factor
  const height = image.height * factor
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from =
        (Math.floor(y / factor) * image.width + Math.floor(x / factor)) * 4
      data.set(image.data.subarray(from, from + 4), (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

/** The image without its first `columns` columns of pixels. */
function croppedLeft(image: Sheet, columns: number): Sheet {
  const width = image.width - columns
  const data = new Uint8ClampedArray(width * image.height * 4)
  for (let y = 0; y < image.height; y++) {
    const from = (y * image.width + columns) * 4
    data.set(image.data.subarray(from, from + width * 4), y * width * 4)
  }
  return { width, height: image.height, data }
}

describe('detectIntegerScale', () => {
  it('finds no scale in an image drawn at its own size', () => {
    expect(detectIntegerScale(nativeImage()).factor).toBe(1)
  })

  it('finds the factor of an image blown up twice', () => {
    expect(detectIntegerScale(blownUp(nativeImage(), 2)).factor).toBe(2)
  })

  // A phase past the edge leaves no block at all, not a block that passes.
  it('finds no scale in an image thinner than the factor', () => {
    const line: Sheet = {
      width: 4,
      height: 1,
      data: Uint8ClampedArray.from([
        0, 0, 0, 255, 50, 0, 0, 255, 100, 0, 0, 255, 150, 0, 0, 255
      ])
    }

    expect(detectIntegerScale(line).factor).toBe(1)
  })

  it('finds the factor of an image blown up three times', () => {
    expect(detectIntegerScale(blownUp(nativeImage(), 3)).factor).toBe(3)
  })

  // A x4 image is x2 too: the largest factor is the one that undoes it.
  it('takes the largest factor that fits', () => {
    expect(detectIntegerScale(blownUp(nativeImage(), 4)).factor).toBe(4)
  })

  it('finds where the blocks start in a capture cut off their grid', () => {
    expect(
      detectIntegerScale(croppedLeft(blownUp(nativeImage(), 2), 1)).phaseX
    ).toBe(1)
  })
})

describe('downscaleSheet', () => {
  it('brings a blown-up image back to its own size', () => {
    const image = blownUp(nativeImage(), 3)

    expect(downscaleSheet(image, detectIntegerScale(image)).width).toBe(3)
  })

  it('keeps the colour of every block', () => {
    const image = blownUp(nativeImage(), 2)

    expect(downscaleSheet(image, detectIntegerScale(image)).data).toEqual(
      nativeImage().data
    )
  })
})
