import type { Sheet } from '@/libs/pixsaur-tileset'
import { inspectSheet } from './inspect-sheet'

/** `width` x 1 pixels; `colourOf` gives the red level of each. */
function row(width: number, colourOf: (x: number) => number): Sheet {
  const data = new Uint8ClampedArray(width * 4)
  for (let x = 0; x < width; x++) {
    data[x * 4] = colourOf(x) % 256
    data[x * 4 + 1] = Math.floor(colourOf(x) / 256)
    data[x * 4 + 3] = 255
  }
  return { width, height: 1, data }
}

/** Two rows of the same pixels, each drawn twice as wide: a x2 capture. */
function blownUpTwice(): Sheet {
  const data = new Uint8ClampedArray(4 * 2 * 4)
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 4; x++) {
      data[(y * 4 + x) * 4] = x < 2 ? 0 : 200
      data[(y * 4 + x) * 4 + 3] = 255
    }
  }
  return { width: 4, height: 2, data }
}

describe('inspectSheet', () => {
  it('offers no reduction for an image at its own size', () => {
    expect(inspectSheet(row(4, (x) => x * 50)).scale).toBeNull()
  })

  it('offers to reduce an image blown up twice', () => {
    expect(inspectSheet(blownUpTwice()).scale?.factor).toBe(2)
  })

  // One colour is uniform at every scale: there is nothing to undo.
  it('offers no reduction for an image of one colour', () => {
    expect(inspectSheet(row(8, () => 0)).scale).toBeNull()
  })

  // M-Q19: native pixel art keeps to a palette; a filter blends it.
  it('suspects a filter past 512 colours', () => {
    expect(inspectSheet(row(600, (x) => x)).filtered).toBe(true)
  })

  it('trusts an image that keeps to a palette', () => {
    expect(inspectSheet(row(600, (x) => x % 20)).filtered).toBe(false)
  })
})
