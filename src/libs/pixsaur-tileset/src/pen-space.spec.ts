import { HOLE_PEN, penSpace } from './pen-space'

const withHole = penSpace(HOLE_PEN)
const flattened = penSpace(null)

describe('penSpace', () => {
  it('keeps the pen the holes were given', () => {
    expect(withHole.holePen).toBe(HOLE_PEN)
  })

  it('has no hole pen when the alpha was flattened', () => {
    expect(flattened.holePen).toBeNull()
  })

  it('shifts a palette index down past the hole', () => {
    expect(withHole.toChosen(3)).toBe(2)
  })

  it('leaves the index alone when no pen was spent on a hole', () => {
    expect(flattened.toChosen(3)).toBe(3)
  })

  it('puts a chosen pen back past the hole', () => {
    expect(withHole.toPalette(2)).toBe(3)
  })

  it('leaves a chosen pen alone when no pen was spent on a hole', () => {
    expect(flattened.toPalette(2)).toBe(2)
  })

  it('knows the first pen is the hole when one was spent', () => {
    expect(withHole.isHole(HOLE_PEN)).toBe(true)
  })

  it('knows no pen is the hole when the alpha was flattened', () => {
    expect(flattened.isHole(HOLE_PEN)).toBe(false)
  })

  it('leaves the pens above the hole to the sheet', () => {
    expect(withHole.isHole(1)).toBe(false)
  })
})
