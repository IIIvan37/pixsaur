import { createStore } from 'jotai'
import type { Sheet } from '@/libs/pixsaur-tileset'
import {
  reduceTilesetSheetAtom,
  selectedTileAtom,
  setTilesetSheetAtom,
  tilesetSheetNameAtom
} from './tileset'

const SHEET: Sheet = {
  width: 1,
  height: 1,
  data: Uint8ClampedArray.from([9, 9, 9, 255])
}

/** A capture blown up twice: 8 x 2 pixels, two colours in 2 x 2 blocks. */
function captureBlownUpTwice(): Sheet {
  const data = new Uint8ClampedArray(8 * 2 * 4)
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 8; x++) {
      data[(y * 8 + x) * 4] = Math.floor(x / 2) % 2 === 0 ? 0 : 200
      data[(y * 8 + x) * 4 + 3] = 255
    }
  }
  return { width: 8, height: 2, data }
}

describe('setTilesetSheetAtom', () => {
  it('keeps the name of the file the sheet came from', () => {
    const store = createStore()

    store.set(setTilesetSheetAtom, SHEET, 'forest.png')

    expect(store.get(tilesetSheetNameAtom)).toBe('forest.png')
  })

  it('forgets the name with the sheet', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, SHEET, 'forest.png')

    store.set(setTilesetSheetAtom, null, 'forest.png')

    expect(store.get(tilesetSheetNameAtom)).toBeNull()
  })

  it('leaves no tile picked on a new sheet', () => {
    const store = createStore()
    store.set(selectedTileAtom, 3)

    store.set(setTilesetSheetAtom, SHEET)

    expect(store.get(selectedTileAtom)).toBeNull()
  })
})

describe('reduceTilesetSheetAtom', () => {
  it('keeps the name of the file it reduces', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, captureBlownUpTwice(), 'capture.png')

    store.set(reduceTilesetSheetAtom)

    expect(store.get(tilesetSheetNameAtom)).toBe('capture.png')
  })
})
