import { createStore } from 'jotai'
import type { Pen, TilesetSheet } from '@/tileset'
import { setTilesetOptionsAtom, tilesetOptionsAtom } from './config'
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

/**
 * What the palette rules decide is tested on the use-case
 * (`src/tileset/application/tileset-options.spec.ts`). What is left here is
 * the wiring: the conversion feeds the slots, and a write reaches the options.
 */
describe('tileset palette atoms', () => {
  it('shows nothing before a sheet is converted', () => {
    expect(createStore().get(tilesetPaletteSlotsAtom)).toEqual([])
  })

  it('shows the pens the conversion chose', () => {
    const store = storeWithSheet()

    expect(store.get(tilesetPaletteSlotsAtom)[1].color).not.toBeNull()
  })

  it('carries a dropped colour to the options', () => {
    const store = storeWithSheet()

    store.set(setTilesetPenAtom, { index: 2, color: WHITE })

    expect(store.get(tilesetOptionsAtom).lockedPens?.[2]).toEqual(WHITE)
  })

  it('pins the pen the conversion gave that index', () => {
    const store = storeWithSheet()
    const pen = store.get(tilesetPaletteSlotsAtom)[2].color

    store.set(toggleTilesetPenLockAtom, 2)

    expect(store.get(tilesetOptionsAtom).lockedPens?.[2]).toEqual(pen)
  })

  it('leaves the options alone when the write is refused', () => {
    const store = storeWithSheet()
    store.set(setTilesetOptionsAtom, { reservedPens: 4 })
    const options = store.get(tilesetOptionsAtom)

    store.set(setTilesetPenAtom, { index: 13, color: WHITE })

    expect(store.get(tilesetOptionsAtom)).toBe(options)
  })
})
