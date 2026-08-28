import { createStore } from 'jotai'
import type { TilesetSheet } from '@/tileset'
import {
  convertedTilesetAtom,
  setTilesetGridAtom,
  setTilesetModeAtom,
  setTilesetOptionsAtom,
  setTilesetSheetAtom,
  setTilesetTargetAtom,
  tilesetGeometryAtom,
  tilesetGridAtom,
  tilesetGridSuggestionsAtom,
  tilesetOptionsAtom,
  tilesetTargetAtom
} from './tileset'

/** A sheet of `count` solid 8 x 8 tiles in a row, every other one repeated. */
function sheetOfAlternatingTiles(count: number): TilesetSheet {
  const width = count * 8
  const data = new Uint8ClampedArray(width * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const light = Math.floor(x / 8) % 2 === 0
      data[at] = light ? 255 : 0
      data[at + 1] = light ? 255 : 0
      data[at + 2] = light ? 255 : 0
      data[at + 3] = 255
    }
  }
  return { width, height: 8, data }
}

describe('tileset workshop atoms', () => {
  it('cuts 8 x 8 tiles until the user says otherwise', () => {
    expect(createStore().get(tilesetGridAtom)).toEqual({
      tileWidth: 8,
      tileHeight: 8
    })
  })

  it('merges a partial grid change into the one already declared', () => {
    const store = createStore()

    store.set(setTilesetGridAtom, { margin: 1 })

    expect(store.get(tilesetGridAtom).tileWidth).toBe(8)
  })

  it('merges a partial target change into the size already declared', () => {
    const store = createStore()

    store.set(setTilesetTargetAtom, { tileWidth: 4 })

    expect(store.get(tilesetTargetAtom)).toEqual({
      tileWidth: 4,
      tileHeight: 8
    })
  })

  it('ranks no grid while no sheet is imported', () => {
    expect(createStore().get(tilesetGridSuggestionsAtom)).toEqual([])
  })

  it('ranks the grid that lands on the tiles first', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfAlternatingTiles(4))

    expect(store.get(tilesetGridSuggestionsAtom)[0].grid.tileWidth).toBe(8)
  })

  it('keeps the blanks the user declared in every ranked grid', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfAlternatingTiles(4))
    store.set(setTilesetGridAtom, { margin: 0, spacing: 0, offsetX: 0 })

    expect(store.get(tilesetGridSuggestionsAtom)[0].grid.offsetX).toBe(0)
  })

  it('widens the reported distortion when the target is stretched', () => {
    const store = createStore()
    const asked = store.get(tilesetGeometryAtom).distortion

    store.set(setTilesetTargetAtom, { tileWidth: 16 })

    expect(store.get(tilesetGeometryAtom).distortion).toBeGreaterThan(asked)
  })

  it('converts nothing while no sheet is imported', () => {
    expect(createStore().get(convertedTilesetAtom)).toBeNull()
  })

  it('converts the imported sheet into a PNG', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfAlternatingTiles(4))

    const result = store.get(convertedTilesetAtom)

    expect(result?.ok).toBe(true)
  })

  it('links the repeated tiles the sheet holds', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfAlternatingTiles(4))

    const result = store.get(convertedTilesetAtom)

    expect(result?.ok === true && result.tileset.unique).toHaveLength(2)
  })

  it('merges a partial option change into the options already set', () => {
    const store = createStore()

    store.set(setTilesetOptionsAtom, { dither: 'ordered' })

    expect(store.get(tilesetOptionsAtom).antiAlias).toBe(true)
  })

  it('drops a frozen palette when the mode changes under it', () => {
    const store = createStore()
    store.set(setTilesetOptionsAtom, { palette: [[0, 0, 0]] })

    store.set(setTilesetModeAtom, 1)

    expect(store.get(tilesetOptionsAtom).palette).toBeUndefined()
  })

  it('keeps a frozen palette when the mode is set to the one already on', () => {
    const store = createStore()
    store.set(setTilesetOptionsAtom, { palette: [[0, 0, 0]] })

    store.set(setTilesetModeAtom, 0)

    expect(store.get(tilesetOptionsAtom).palette).toHaveLength(1)
  })
})
