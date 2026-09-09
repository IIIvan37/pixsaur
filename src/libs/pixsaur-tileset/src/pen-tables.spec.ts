import { HOLE_PEN, penSpace } from './pen-space'
import { penTables } from './pen-tables'

/** One channel is enough to pin the arithmetic; the metric is the caller's. */
const apart = (a: readonly number[], b: readonly number[]) =>
  Math.abs(a[0] - b[0])

const flattened = penSpace(null)
const withHole = penSpace(HOLE_PEN)

const tablesOf = (wanted: number[][], chosen: number[][], space = flattened) =>
  penTables({ wanted, chosen, distance: apart, space })

describe('penTables', () => {
  it('gives each wanted colour the pen standing closest to it', () => {
    const { mix } = tablesOf([[0], [10], [100]], [[0], [100]])

    expect(Array.from(mix.primary)).toEqual([0, 0, 1])
  })

  it('names that pen where the palette holds it, past the hole', () => {
    const { mix } = tablesOf([[0], [10], [100]], [[0], [100]], withHole)

    expect(Array.from(mix.primary)).toEqual([1, 1, 2])
  })

  it('keeps the first of two pens equally close', () => {
    const { mix } = tablesOf([[50]], [[0], [100]])

    expect(mix.primary[0]).toBe(0)
  })

  it('reports how far a colour had to travel to reach its pen', () => {
    const { error } = tablesOf([[10]], [[0]])

    expect([...error]).toEqual([10])
  })

  it('charges a colour a pen carries exactly nothing', () => {
    const { error } = tablesOf([[10]], [[10], [0]])

    expect(error[0]).toBe(0)
  })

  it('names the second nearest pen as the other half of the mixture', () => {
    const { mix } = tablesOf([[10]], [[0], [100], [12]])

    expect(mix.secondary[0]).toBe(0)
  })

  it('mixes a lone pen with itself', () => {
    const { mix } = tablesOf([[10]], [[0]])

    expect(mix.secondary[0]).toBe(0)
  })

  it('says how far along the two pens a colour halfway sits', () => {
    const { mix } = tablesOf([[50]], [[0], [100]])

    expect(mix.mix[0]).toBe(0.5)
  })

  it('says a quarter when the colour sits a quarter of the way', () => {
    const { mix } = tablesOf([[25]], [[0], [100]])

    expect(mix.mix[0]).toBe(0.25)
  })

  it('never asks for a mix outside the segment joining the two pens', () => {
    const { mix } = tablesOf([[-50]], [[0], [100]])

    expect(mix.mix[0]).toBe(0)
  })

  it('asks for no mix at all when both pens paint the same colour', () => {
    const { mix } = tablesOf([[10]], [[0], [0]])

    expect(mix.mix[0]).toBe(0)
  })

  it('hands the diffusion the colour an index asks for', () => {
    const { diffusion } = tablesOf([[0], [10]], [[0]])

    expect([...diffusion.wanted(1)]).toEqual([10])
  })

  it('hands the diffusion the colour a palette pen paints', () => {
    const { diffusion } = tablesOf([[0]], [[0], [100]], withHole)

    expect([...diffusion.painted(2)]).toEqual([100])
  })

  it('finds the diffusion a pen for a colour no index carries', () => {
    const { diffusion } = tablesOf([[0]], [[0], [100]], withHole)

    expect(diffusion.nearest([90])).toBe(2)
  })
})
