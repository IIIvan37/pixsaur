import {
  type BayerSize,
  bayerThresholds,
  orderedDitherTile
} from './ordered-dither'

const flat = { primary: [3], secondary: [5], mix: [0] }
const halfway = { primary: [3], secondary: [5], mix: [0.5] }

describe('orderedDitherTile', () => {
  it('leaves a colour a pen already carries alone', () => {
    expect([...orderedDitherTile([0, 0, 0, 0], 2, 2, flat)]).toEqual([
      3, 3, 3, 3
    ])
  })

  it('splits a colour halfway between two pens evenly', () => {
    expect([...orderedDitherTile([0, 0, 0, 0], 2, 2, halfway)]).toEqual([
      5, 3, 3, 5
    ])
  })

  it('spreads a faint tint over a wider matrix than a narrow one would', () => {
    const faint = { primary: [3], secondary: [5], mix: [0.1] }
    expect([...orderedDitherTile([0, 0, 0, 0], 2, 2, faint)]).toEqual([
      5, 3, 3, 3
    ])
  })

  it('takes a narrower matrix when asked for one', () => {
    const faint = { primary: [3], secondary: [5], mix: [0.1] }
    expect([
      ...orderedDitherTile([0, 0, 0, 0], 2, 2, faint, { size: 2 })
    ]).toEqual([3, 3, 3, 3])
  })

  it('keeps off the contours the anti-aliasing owns', () => {
    const onEdge = { primary: [3], secondary: [5], mix: [1] }
    expect(
      [
        ...orderedDitherTile([0, 0, 0, 0], 2, 2, onEdge, { mask: [1, 0, 0, 0] })
      ][0]
    ).toBe(3)
  })

  it('leaves a hole to the transparency pen', () => {
    expect(
      [
        ...orderedDitherTile([9, 0, 0, 0], 2, 2, halfway, {
          ignore: 9,
          holePen: 7
        })
      ][0]
    ).toBe(7)
  })
})

describe('bayerThresholds', () => {
  it('builds the textbook 4x4 matrix by recursion', () => {
    expect([...bayerThresholds(4)].map((t) => t * 16 - 0.5)).toEqual([
      0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5
    ])
  })
})

describe('BayerSize', () => {
  it.each([2, 4, 8] as const)('builds the %i x %i matrix in full', (size) => {
    expect(bayerThresholds(size)).toHaveLength(size * size)
  })

  it('is the three sides the workshop offers, and nothing else', () => {
    // @ts-expect-error 5 is not a Bayer size; the union is what refuses it.
    const off: BayerSize = 5

    expect(off).toBe(5)
  })
})
