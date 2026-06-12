import {
  countLockedEmptySlots,
  extractLockedColors,
  isLockedEmpty,
  isLockedWithColor,
  type PaletteSlot
} from './slot'

const slot = (over: Partial<PaletteSlot> = {}): PaletteSlot => ({
  color: null,
  locked: false,
  ...over
})

describe('extractLockedColors', () => {
  it('returns colors from locked, non-empty slots only', () => {
    const slots: PaletteSlot[] = [
      slot({ color: [10, 10, 10], locked: true }),
      slot({ color: [20, 20, 20], locked: false }), // not locked
      slot({ color: null, locked: true }), // locked but empty
      slot({ color: [30, 30, 30], locked: true })
    ]
    expect(extractLockedColors(slots)).toEqual([
      [10, 10, 10],
      [30, 30, 30]
    ])
  })

  it('returns an empty array when nothing is locked', () => {
    expect(extractLockedColors([slot(), slot()])).toEqual([])
  })
})

describe('countLockedEmptySlots', () => {
  it('counts locked slots with no color', () => {
    const slots: PaletteSlot[] = [
      slot({ color: null, locked: true }),
      slot({ color: [1, 1, 1], locked: true }), // has color
      slot({ color: null, locked: false }), // not locked
      slot({ color: null, locked: true })
    ]
    expect(countLockedEmptySlots(slots)).toBe(2)
  })

  it('only considers the first maxSlots entries', () => {
    const slots: PaletteSlot[] = [
      slot({ color: null, locked: true }),
      slot({ color: null, locked: true }),
      slot({ color: null, locked: true })
    ]
    expect(countLockedEmptySlots(slots, 2)).toBe(2)
  })

  it('defaults maxSlots to 16', () => {
    const slots: PaletteSlot[] = Array.from({ length: 20 }, () =>
      slot({ color: null, locked: true })
    )
    expect(countLockedEmptySlots(slots)).toBe(16)
  })
})

describe('isLockedWithColor / isLockedEmpty', () => {
  it('detects a locked slot that holds a color', () => {
    expect(isLockedWithColor(slot({ color: [1, 2, 3], locked: true }))).toBe(
      true
    )
    expect(isLockedWithColor(slot({ color: null, locked: true }))).toBe(false)
    expect(isLockedWithColor(slot({ color: [1, 2, 3], locked: false }))).toBe(
      false
    )
  })

  it('detects a locked but empty slot', () => {
    expect(isLockedEmpty(slot({ color: null, locked: true }))).toBe(true)
    expect(isLockedEmpty(slot({ color: [1, 2, 3], locked: true }))).toBe(false)
    expect(isLockedEmpty(slot({ color: null, locked: false }))).toBe(false)
  })
})
