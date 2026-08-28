import { antiAliasTile } from './anti-alias'

const midpoint = (sides: readonly number[]) =>
  Math.round(sides.reduce((a, b) => a + b, 0) / sides.length)

describe('antiAliasTile', () => {
  it('softens the corner where a boundary turns', () => {
    expect([...antiAliasTile([2, 8, 8, 8], 2, 2, midpoint)]).toEqual([
      5, 8, 8, 8
    ])
  })

  it('leaves a straight boundary sharp', () => {
    expect([...antiAliasTile([2, 8, 2, 8], 2, 2, midpoint)]).toEqual([
      2, 8, 2, 8
    ])
  })

  it('leaves a flat tile untouched', () => {
    expect([...antiAliasTile([8, 8, 8, 8], 2, 2, midpoint)]).toEqual([
      8, 8, 8, 8
    ])
  })

  it('refuses to blend a silhouette with the hole behind it', () => {
    expect(
      [...antiAliasTile([2, 8, 9, 8], 2, 2, midpoint, { ignore: 9 })][0]
    ).toBe(2)
  })

  it('blends against the colour most of the neighbours carry', () => {
    const cross = [8, 2, 8, 4, 8, 4, 8, 4, 8]
    expect([...antiAliasTile(cross, 3, 3, midpoint)][4]).toBe(6)
  })

  it('breaks a tie between neighbours in a fixed order', () => {
    expect([...antiAliasTile([2, 8, 4, 8], 2, 2, midpoint)][0]).toBe(5)
  })
})
