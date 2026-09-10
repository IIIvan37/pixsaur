import { countColours } from './count-colours'
import type { Sheet } from './slice-sheet'

/** One pixel per red level asked for, fully opaque. */
function reds(levels: number[]): Sheet {
  const data = new Uint8ClampedArray(levels.length * 4)
  levels.forEach((red, at) => {
    data[at * 4] = red
    data[at * 4 + 3] = 255
  })
  return { width: levels.length, height: 1, data }
}

describe('countColours', () => {
  it('counts each distinct colour once', () => {
    expect(countColours(reds([0, 10, 0, 20, 10]), 100)).toBe(3)
  })

  it('stops counting one past the limit', () => {
    expect(countColours(reds([0, 1, 2, 3, 4, 5, 6, 7]), 4)).toBe(5)
  })
})
