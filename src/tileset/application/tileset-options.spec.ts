import type { Pen } from './pens'
import {
  type ConvertedPalette,
  dropPen,
  freezePalette,
  setTileDither,
  thawPalette,
  tilesetPaletteSlots,
  togglePenLock
} from './tileset-options'
import type { TilesetProjectOptions } from './tileset-project'

const BLACK: Pen = [0, 0, 0]
const RED: Pen = [255, 0, 0]
const WHITE: Pen = [255, 255, 255]

const NOTHING: TilesetProjectOptions = {}

/** A conversion that filled three of the mode's pens, the hole first. */
const produced: ConvertedPalette = { palette: [BLACK, RED, WHITE] }

describe('tilesetPaletteSlots', () => {
  it('shows nothing before a sheet is converted', () => {
    expect(
      tilesetPaletteSlots({ mode: 0, options: NOTHING, produced: null })
    ).toEqual([])
  })

  it('shows one slot per pen the mode holds, not per pen the sheet needed', () => {
    expect(
      tilesetPaletteSlots({ mode: 0, options: NOTHING, produced })
    ).toHaveLength(16)
  })

  it('shows four slots in mode 1', () => {
    expect(
      tilesetPaletteSlots({ mode: 1, options: NOTHING, produced })
    ).toHaveLength(4)
  })

  it('leaves a slot the conversion did not fill empty', () => {
    const slots = tilesetPaletteSlots({ mode: 0, options: NOTHING, produced })

    expect(slots[15].color).toBeNull()
  })

  it('marks the transparency pen as locked', () => {
    const slots = tilesetPaletteSlots({ mode: 0, options: NOTHING, produced })

    expect(slots[0].locked).toBe(true)
  })

  it('marks a reserved pen as locked', () => {
    const slots = tilesetPaletteSlots({
      mode: 0,
      options: { reservedPens: 4 },
      produced
    })

    expect(slots[12].locked).toBe(true)
  })

  it('marks a pinned pen as locked', () => {
    const slots = tilesetPaletteSlots({
      mode: 0,
      options: { lockedPens: { 2: WHITE } },
      produced
    })

    expect(slots[2].locked).toBe(true)
  })

  it('leaves a pen the user may still move unlocked', () => {
    const slots = tilesetPaletteSlots({ mode: 0, options: NOTHING, produced })

    expect(slots[2].locked).toBe(false)
  })
})

describe('dropPen', () => {
  it('pins the colour at the index it was dropped on', () => {
    const options = dropPen({
      mode: 0,
      options: NOTHING,
      index: 2,
      color: WHITE
    })

    expect(options.lockedPens?.[2]).toEqual(WHITE)
  })

  it('writes the background when the pen is the hole', () => {
    const options = dropPen({
      mode: 0,
      options: NOTHING,
      index: 0,
      color: WHITE
    })

    expect(options.background).toEqual(WHITE)
  })

  it('leaves the hole unpinned when its colour changes', () => {
    const options = dropPen({
      mode: 0,
      options: NOTHING,
      index: 0,
      color: WHITE
    })

    expect(options.lockedPens).toBeUndefined()
  })

  it('pins the first pen when the holes are flattened', () => {
    const options = dropPen({
      mode: 0,
      options: { transparency: 'flatten' },
      index: 0,
      color: WHITE
    })

    expect(options.lockedPens?.[0]).toEqual(WHITE)
  })

  it('writes into a frozen palette rather than pinning', () => {
    const options = dropPen({
      mode: 0,
      options: { palette: [BLACK, RED] },
      index: 1,
      color: WHITE
    })

    expect(options.palette?.[1]).toEqual(WHITE)
  })

  it('leaves a pen the sprites were promised alone', () => {
    const options: TilesetProjectOptions = { reservedPens: 4 }

    expect(dropPen({ mode: 0, options, index: 13, color: WHITE })).toBe(options)
  })
})

describe('togglePenLock', () => {
  it('pins the pen the conversion gave that index', () => {
    const options = togglePenLock({
      mode: 0,
      options: NOTHING,
      produced,
      index: 2
    })

    expect(options.lockedPens?.[2]).toEqual(WHITE)
  })

  it('hands a pinned pen back to the strategy', () => {
    const options = togglePenLock({
      mode: 0,
      options: { lockedPens: { 2: WHITE } },
      produced,
      index: 2
    })

    expect(options.lockedPens?.[2]).toBeUndefined()
  })

  it('refuses to pin the hole', () => {
    expect(
      togglePenLock({ mode: 0, options: NOTHING, produced, index: 0 })
    ).toBe(NOTHING)
  })

  it('refuses a pen the conversion never filled', () => {
    expect(
      togglePenLock({ mode: 0, options: NOTHING, produced, index: 9 })
    ).toBe(NOTHING)
  })
})

describe('freezePalette', () => {
  it('takes the palette the conversion chose as the palette', () => {
    expect(freezePalette(NOTHING, [BLACK, RED]).palette).toEqual([BLACK, RED])
  })
})

describe('thawPalette', () => {
  it('hands the palette back to the strategy', () => {
    expect(thawPalette({ palette: [BLACK, RED] }).palette).toBeUndefined()
  })

  it('keeps every other setting', () => {
    expect(
      thawPalette({ palette: [BLACK], reservedPens: 4 }).reservedPens
    ).toBe(4)
  })
})

describe('setTileDither', () => {
  /** Four tiles, the third a copy of the first. */
  const instanceOf = [0, 1, 0, 3]

  it('overrules the dithering on every instance of the tile', () => {
    const options = setTileDither({
      options: NOTHING,
      instanceOf,
      tile: 0,
      dither: 'ordered'
    })

    expect(options.ditherByTile).toEqual({ 0: 'ordered', 2: 'ordered' })
  })

  it('leaves the other tiles to the setting of the sheet', () => {
    const options = setTileDither({
      options: NOTHING,
      instanceOf,
      tile: 0,
      dither: 'ordered'
    })

    expect(options.ditherByTile?.[1]).toBeUndefined()
  })

  it('hands the tile back to the dithering of the sheet', () => {
    const overruled = setTileDither({
      options: NOTHING,
      instanceOf,
      tile: 0,
      dither: 'ordered'
    })

    const options = setTileDither({
      options: overruled,
      instanceOf,
      tile: 2,
      dither: null
    })

    expect(options.ditherByTile).toEqual({})
  })
})
