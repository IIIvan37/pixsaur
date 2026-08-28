import { dedupeTiles, duplicateRate } from './tile-dedup'

const red = Uint8ClampedArray.from([255, 0, 0, 255])
const blue = Uint8ClampedArray.from([0, 0, 255, 255])
const nearlyRed = Uint8ClampedArray.from([255, 0, 0, 254])

describe('dedupeTiles', () => {
  it('links a repeated tile back to its first occurrence', () => {
    expect(dedupeTiles([red, blue, red]).instanceOf).toEqual([0, 1, 0])
  })

  it('keeps apart two tiles differing by their last byte alone', () => {
    expect(dedupeTiles([red, nearlyRed]).instanceOf).toEqual([0, 1])
  })

  it('lists the first occurrence of each distinct tile', () => {
    expect(dedupeTiles([red, blue, red]).unique).toEqual([0, 1])
  })
})

describe('duplicateRate', () => {
  it('reports the share of tiles repeating one already seen', () => {
    expect(duplicateRate(dedupeTiles([red, blue, red]))).toBeCloseTo(1 / 3)
  })

  it('reports nothing to deduplicate when there is no tile at all', () => {
    expect(duplicateRate(dedupeTiles([]))).toBe(0)
  })
})
