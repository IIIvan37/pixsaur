import {
  clearColorMapping,
  getColorMapping,
  lookupColorIndex,
  setColorMapping
} from './color-mapping-cache'

describe('lookupColorIndex', () => {
  it('reads an index out of the mapping it is given', () => {
    const mapping = new Map([
      ['255,0,0', 3],
      ['0,128,64', 1]
    ])

    expect(lookupColorIndex(mapping, 255, 0, 0)).toBe(3)
    expect(lookupColorIndex(mapping, 0, 128, 64)).toBe(1)
  })

  it('returns undefined for a colour the mapping does not cover', () => {
    expect(lookupColorIndex(new Map([['255,0,0', 3]]), 12, 34, 56)).toBe(
      undefined
    )
  })

  it('returns undefined when there is no mapping at all', () => {
    expect(lookupColorIndex(null, 255, 0, 0)).toBe(undefined)
  })

  it('is pure — it never consults the ambient transport', () => {
    setColorMapping(new Map([['255,0,0', 7]]))
    try {
      expect(lookupColorIndex(null, 255, 0, 0)).toBe(undefined)
      expect(lookupColorIndex(new Map(), 255, 0, 0)).toBe(undefined)
    } finally {
      clearColorMapping()
    }
  })
})

describe('the ambient transport', () => {
  afterEach(() => {
    clearColorMapping()
  })

  it('hands the mapping over once so it can be drained into a value', () => {
    const mapping = new Map([['1,2,3', 0]])
    setColorMapping(mapping)

    expect(getColorMapping()).toBe(mapping)
  })

  it('reports nothing once cleared', () => {
    setColorMapping(new Map([['1,2,3', 0]]))
    clearColorMapping()

    expect(getColorMapping()).toBe(null)
  })

  it('treats an empty mapping as nothing to carry', () => {
    setColorMapping(new Map())

    expect(getColorMapping()).toBe(null)
  })
})
