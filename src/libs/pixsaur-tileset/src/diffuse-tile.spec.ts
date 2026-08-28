import { diffuseTile } from './diffuse-tile'

/** Two pens on a line, 0 and 10; every pixel asks for the same `value`. */
const ramp = (value: number) => ({
  wanted: () => [value],
  painted: (pen: number) => [pen * 10],
  nearest: ([v]: readonly number[]) => (v < 5 ? 0 : 1)
})

describe('diffuseTile', () => {
  it('keeps a colour a pen already carries', () => {
    expect([...diffuseTile([0, 0, 0, 0], 4, 1, ramp(0))]).toEqual([0, 0, 0, 0])
  })

  it('alternates the two pens a colour sits between', () => {
    expect([...diffuseTile([0, 0, 0, 0], 4, 1, ramp(5))]).toEqual([1, 0, 1, 0])
  })

  it('lets no error leak out of a contour', () => {
    expect(
      [...diffuseTile([0, 0, 0, 0], 4, 1, ramp(5), { mask: [1, 0, 0, 0] })][1]
    ).toBe(1)
  })

  it('leaves a hole to the transparency pen', () => {
    expect(
      [
        ...diffuseTile([9, 0, 0, 0], 4, 1, ramp(5), { ignore: 9, holePen: 7 })
      ][0]
    ).toBe(7)
  })

  it('starts the next tile with an empty accumulator', () => {
    const first = [...diffuseTile([0, 0, 0, 0], 4, 1, ramp(5))]
    expect([...diffuseTile([0, 0, 0, 0], 4, 1, ramp(5))]).toEqual(first)
  })

  it('carries the residual down to the next row', () => {
    expect([...diffuseTile([0, 0, 0, 0], 2, 2, ramp(5))]).toEqual([1, 0, 0, 1])
  })
})
