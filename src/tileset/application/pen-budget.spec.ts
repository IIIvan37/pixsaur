import {
  hasPensToSpare,
  holePen,
  penBudget,
  penCount,
  pinnablePen,
  transparencyOf
} from './pen-budget'

describe('penCount', () => {
  it('gives mode 0 sixteen pens', () => {
    expect(penCount(0)).toBe(16)
  })

  it('gives mode 1 four pens', () => {
    expect(penCount(1)).toBe(4)
  })

  it('gives mode 2 two pens', () => {
    expect(penCount(2)).toBe(2)
  })
})

describe('penBudget', () => {
  it('spends the whole mode when nothing is reserved', () => {
    expect(penBudget({ mode: 0 })).toBe(16)
  })

  it('keeps the reserved pens out of it', () => {
    expect(penBudget({ mode: 0, reservedPens: 4 })).toBe(12)
  })
})

describe('hasPensToSpare', () => {
  it('says mode 0 has one', () => {
    expect(hasPensToSpare(0)).toBe(true)
  })

  it('says mode 1 has none', () => {
    expect(hasPensToSpare(1)).toBe(false)
  })
})

describe('transparencyOf', () => {
  it('spends a pen on the holes in mode 0', () => {
    expect(transparencyOf({ mode: 0 })).toBe('pen')
  })

  it('flattens them in mode 1, where no pen can be spared', () => {
    expect(transparencyOf({ mode: 1 })).toBe('flatten')
  })

  it('honours a setting the mode would not have chosen', () => {
    expect(transparencyOf({ mode: 1, transparency: 'pen' })).toBe('pen')
  })
})

describe('holePen', () => {
  it('puts the hole first, where the sprite routines look for it', () => {
    expect(holePen({ mode: 0 })).toBe(0)
  })

  it('names no pen when the holes are flattened', () => {
    expect(holePen({ mode: 0, transparency: 'flatten' })).toBeNull()
  })
})

describe('pinnablePen', () => {
  it('lets the user pin a pen the tileset owns', () => {
    expect(pinnablePen(2, { mode: 0 })).toBe(true)
  })

  it('refuses the hole, whose colour the conversion owns', () => {
    expect(pinnablePen(0, { mode: 0 })).toBe(false)
  })

  it('opens the first pen when the holes are flattened', () => {
    expect(pinnablePen(0, { mode: 0, transparency: 'flatten' })).toBe(true)
  })

  it('refuses a pen promised to the sprites', () => {
    expect(pinnablePen(13, { mode: 0, reservedPens: 4 })).toBe(false)
  })

  it('refuses a pen the mode has not got', () => {
    expect(pinnablePen(5, { mode: 1 })).toBe(false)
  })

  it('refuses an index that is not a pen at all', () => {
    expect(pinnablePen(1.5, { mode: 0 })).toBe(false)
  })
})
