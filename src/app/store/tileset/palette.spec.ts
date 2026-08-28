import { createStore } from 'jotai'
import type { Pen, TilesetSheet } from '@/tileset'
import {
  setTilesetModeAtom,
  setTilesetOptionsAtom,
  tilesetOptionsAtom
} from './config'
import {
  setTilesetPenAtom,
  tilesetPaletteSlotsAtom,
  toggleTilesetPenLockAtom
} from './palette'
import { setTilesetSheetAtom } from './sheet'

const WHITE: Pen = [255, 255, 255]

/** Two solid 8 × 8 tiles, red then blue — enough for a palette to exist. */
function sheetOfTwoTiles(): TilesetSheet {
  const width = 16
  const height = 8
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = x < 8 ? 255 : 0
      data[i + 2] = x < 8 ? 0 : 255
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

/** A store with a sheet loaded and a grid that slices it into two tiles. */
function storeWithSheet() {
  const store = createStore()
  store.set(setTilesetSheetAtom, sheetOfTwoTiles())
  return store
}

describe('tilesetPaletteSlotsAtom', () => {
  it('shows nothing before a sheet is converted', () => {
    expect(createStore().get(tilesetPaletteSlotsAtom)).toEqual([])
  })

  it('shows one slot per pen the mode holds, not per pen the sheet needed', () => {
    const store = storeWithSheet()

    expect(store.get(tilesetPaletteSlotsAtom)).toHaveLength(16)
  })

  it('shows four slots in mode 1', () => {
    const store = storeWithSheet()
    store.set(setTilesetModeAtom, 1)

    expect(store.get(tilesetPaletteSlotsAtom)).toHaveLength(4)
  })

  it('leaves a slot the conversion did not fill empty', () => {
    const store = storeWithSheet()

    expect(store.get(tilesetPaletteSlotsAtom)[15].color).toBeNull()
  })

  it('marks a reserved pen as locked', () => {
    const store = storeWithSheet()
    store.set(setTilesetOptionsAtom, { reservedPens: 4 })

    expect(store.get(tilesetPaletteSlotsAtom)[12].locked).toBe(true)
  })

  it('marks the transparency pen as locked', () => {
    const store = storeWithSheet()

    expect(store.get(tilesetPaletteSlotsAtom)[0].locked).toBe(true)
  })

  it('marks a pinned pen as locked', () => {
    const store = storeWithSheet()
    store.set(setTilesetOptionsAtom, { lockedPens: { 2: WHITE } })

    expect(store.get(tilesetPaletteSlotsAtom)[2].locked).toBe(true)
  })
})

describe('setTilesetPenAtom', () => {
  it('pins the colour at the index it was dropped on', () => {
    const store = storeWithSheet()

    store.set(setTilesetPenAtom, { index: 2, color: WHITE })

    expect(store.get(tilesetOptionsAtom).lockedPens?.[2]).toEqual(WHITE)
  })

  it('writes the background when the pen is the hole', () => {
    const store = storeWithSheet()

    store.set(setTilesetPenAtom, { index: 0, color: WHITE })

    expect(store.get(tilesetOptionsAtom).background).toEqual(WHITE)
  })

  it('leaves the hole unpinned when its colour changes', () => {
    const store = storeWithSheet()

    store.set(setTilesetPenAtom, { index: 0, color: WHITE })

    expect(store.get(tilesetOptionsAtom).lockedPens).toBeUndefined()
  })

  it('writes into a frozen palette rather than pinning', () => {
    const store = storeWithSheet()
    store.set(setTilesetOptionsAtom, {
      palette: [
        [0, 0, 0],
        [255, 0, 0]
      ]
    })

    store.set(setTilesetPenAtom, { index: 1, color: WHITE })

    expect(store.get(tilesetOptionsAtom).palette?.[1]).toEqual(WHITE)
  })
})

describe('setTilesetPenAtom, on a reserved pen', () => {
  it('leaves a pen the sprites were promised alone', () => {
    const store = storeWithSheet()
    store.set(setTilesetOptionsAtom, { reservedPens: 4 })

    store.set(setTilesetPenAtom, { index: 13, color: WHITE })

    expect(store.get(tilesetOptionsAtom).lockedPens).toBeUndefined()
  })
})

describe('toggleTilesetPenLockAtom', () => {
  it('pins the pen the conversion gave that index', () => {
    const store = storeWithSheet()
    const pen = store.get(tilesetPaletteSlotsAtom)[2].color

    store.set(toggleTilesetPenLockAtom, 2)

    expect(store.get(tilesetOptionsAtom).lockedPens?.[2]).toEqual(pen)
  })

  it('hands a pinned pen back to the strategy', () => {
    const store = storeWithSheet()
    store.set(setTilesetOptionsAtom, { lockedPens: { 2: WHITE } })

    store.set(toggleTilesetPenLockAtom, 2)

    expect(store.get(tilesetOptionsAtom).lockedPens?.[2]).toBeUndefined()
  })

  it('refuses to pin the hole', () => {
    const store = storeWithSheet()

    store.set(toggleTilesetPenLockAtom, 0)

    expect(store.get(tilesetOptionsAtom).lockedPens).toBeUndefined()
  })
})
