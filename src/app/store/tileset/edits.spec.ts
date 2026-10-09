import { createStore } from 'jotai'
import type { Sheet } from '@/libs/pixsaur-tileset'
import {
  editedTilesetAtom,
  paintTilesetAtom,
  renderedTilesetSheetAtom,
  setTilesetGridAtom,
  setTilesetModeAtom,
  setTilesetSheetAtom,
  setTilesetTargetAtom,
  tilesetEditLayerAtom
} from './tileset'

/** Four colours over eight solid 8 x 8 tiles: every tile has a twin. */
const COLOURS: [number, number, number][] = [
  [0, 0, 0],
  [255, 255, 255],
  [255, 0, 0],
  [0, 255, 0]
]

function sheetOfRepeatedColours(): Sheet {
  const width = 2 * COLOURS.length * 8
  const data = new Uint8ClampedArray(width * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const colour = COLOURS[Math.floor(x / 8) % COLOURS.length]
      data[at] = colour[0]
      data[at + 1] = colour[1]
      data[at + 2] = colour[2]
      data[at + 3] = 255
    }
  }
  return { width, height: 8, data }
}

/** A store with a sheet loaded and one pixel painted in the first tile. */
function painted() {
  const store = createStore()
  store.set(setTilesetSheetAtom, sheetOfRepeatedColours())
  store.set(paintTilesetAtom, { tile: 0, pixels: [{ x: 0, y: 0 }], pen: 3 })
  return store
}

/** The pen standing at the top-left of `tile`, as the workshop shows it. */
function penAt(store: ReturnType<typeof createStore>, tile: number): number {
  const result = store.get(editedTilesetAtom)
  if (!result?.ok) throw new Error('the conversion failed')
  return result.tileset.tiles[tile].indices[0]
}

/** The pixels of the sheet as the workshop shows it. */
function pixelsOf(store: ReturnType<typeof createStore>): Uint8ClampedArray {
  const sheet = store.get(renderedTilesetSheetAtom)
  if (!sheet) throw new Error('the conversion failed')
  return sheet.data
}

describe('tileset edit layer atoms', () => {
  it('paints nothing while no sheet is imported', () => {
    const store = createStore()

    store.set(paintTilesetAtom, { tile: 0, pixels: [{ x: 0, y: 0 }], pen: 3 })

    expect(store.get(tilesetEditLayerAtom)).toEqual({})
  })

  it('shows the painted pen in the converted sheet', () => {
    expect(penAt(painted(), 0)).toBe(3)
  })

  it('carries the stroke to the instances of the tile', () => {
    expect(penAt(painted(), COLOURS.length)).toBe(3)
  })

  it('leaves the other tiles untouched', () => {
    expect(penAt(painted(), 1)).not.toBe(3)
  })

  it('redraws the sheet so it carries the stroke', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfRepeatedColours())
    const before = pixelsOf(store)

    store.set(paintTilesetAtom, { tile: 0, pixels: [{ x: 0, y: 0 }], pen: 3 })

    expect(pixelsOf(store)).not.toEqual(before)
  })

  it('forgets the edits when the cutting grid moves', () => {
    const store = painted()

    store.set(setTilesetGridAtom, { margin: 1 })

    expect(store.get(tilesetEditLayerAtom)).toEqual({})
  })

  it('forgets the edits when the destination tile changes', () => {
    const store = painted()

    store.set(setTilesetTargetAtom, { tileWidth: 4 })

    expect(store.get(tilesetEditLayerAtom)).toEqual({})
  })

  it('forgets the edits when another sheet is imported', () => {
    const store = painted()

    store.set(setTilesetSheetAtom, sheetOfRepeatedColours())

    expect(store.get(tilesetEditLayerAtom)).toEqual({})
  })

  it('forgets the edits when the mode changes', () => {
    const store = painted()

    store.set(setTilesetModeAtom, 1)

    expect(store.get(tilesetEditLayerAtom)).toEqual({})
  })
})
