import { tileEdgeMask } from './edge-mask'

describe('tileEdgeMask', () => {
  it('leaves a flat tile to the ditherer', () => {
    expect([...tileEdgeMask([7, 7, 7, 7], 2, 2)]).toEqual([0, 0, 0, 0])
  })

  it('claims both sides of a colour boundary', () => {
    expect([...tileEdgeMask([1, 2, 1, 2], 2, 2)]).toEqual([1, 1, 1, 1])
  })

  it('reads only the four neighbours, not the diagonal', () => {
    expect([...tileEdgeMask([1, 1, 1, 2], 2, 2)][0]).toBe(0)
  })

  it('leaves a hole out of the contour it would blur', () => {
    expect([...tileEdgeMask([1, 9, 1, 1], 2, 2, { ignore: 9 })]).toEqual([
      0, 0, 0, 0
    ])
  })
})
