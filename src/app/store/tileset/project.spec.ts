import { createStore } from 'jotai'
import type { Sheet } from '@/libs/pixsaur-tileset'
import type { TilesetProject } from '@/tileset'
import { TILESET_PROJECT_VERSION } from '@/tileset'
import { captureTilesetProjectAtom, restoreTilesetProjectAtom } from './project'
import {
  setTilesetGridAtom,
  setTilesetLayoutAtom,
  setTilesetMapOptionsAtom,
  setTilesetOptionsAtom,
  setTilesetSheetAtom,
  tilesetEditLayerAtom,
  tilesetGridAtom,
  tilesetLayoutAtom,
  tilesetMapOptionsAtom,
  tilesetModeAtom,
  tilesetOptionsAtom,
  tilesetSheetAtom
} from './tileset'

const SHEET: Sheet = {
  width: 1,
  height: 1,
  data: Uint8ClampedArray.from([9, 9, 9, 255])
}

const STROKE = {
  tiles: [0],
  edits: [{ x: 0, y: 0, previousInkIndex: 0, newInkIndex: 2 }],
  timestamp: 7
}

function projectOf(overrides: Partial<TilesetProject> = {}): TilesetProject {
  return {
    version: TILESET_PROJECT_VERSION,
    sheet: SHEET,
    source: { tileWidth: 4, tileHeight: 4, margin: 1 },
    target: { tileWidth: 2, tileHeight: 2 },
    mode: 1,
    hardware: 'plus',
    sourcePlatform: 'snes',
    options: { resize: 'nearest', palette: [[0, 0, 0]] },
    edits: { strokes: [STROKE], at: 0 },
    layout: 'map',
    map: { budget: 64 },
    ...overrides
  }
}

describe('layout and map options', () => {
  it('carries the layout the source is read with', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, SHEET)

    store.set(setTilesetLayoutAtom, 'map')

    expect(store.get(captureTilesetProjectAtom)?.layout).toBe('map')
  })

  it('carries the map options', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, SHEET)

    store.set(setTilesetMapOptionsAtom, { budget: 32 })

    expect(store.get(captureTilesetProjectAtom)?.map).toEqual({ budget: 32 })
  })

  it('puts the layout back', () => {
    const store = createStore()

    store.set(restoreTilesetProjectAtom, projectOf())

    expect(store.get(tilesetLayoutAtom)).toBe('map')
  })

  it('puts the map options back', () => {
    const store = createStore()

    store.set(restoreTilesetProjectAtom, projectOf())

    expect(store.get(tilesetMapOptionsAtom)).toEqual({ budget: 64 })
  })
})

describe('captureTilesetProjectAtom', () => {
  it('has nothing to save before a sheet is imported', () => {
    expect(createStore().get(captureTilesetProjectAtom)).toBeNull()
  })

  it('carries the sheet the workshop holds', () => {
    const store = createStore()

    store.set(setTilesetSheetAtom, SHEET)

    expect(store.get(captureTilesetProjectAtom)?.sheet).toBe(SHEET)
  })

  it('carries the grid the sheet is cut on', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, SHEET)

    store.set(setTilesetGridAtom, { margin: 3 })

    expect(store.get(captureTilesetProjectAtom)?.source.margin).toBe(3)
  })

  it('carries the settings the conversion runs on', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, SHEET)

    store.set(setTilesetOptionsAtom, { reservedPens: 2 })

    expect(store.get(captureTilesetProjectAtom)?.options.reservedPens).toBe(2)
  })

  it('carries the strokes painted so far', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, SHEET)

    store.set(tilesetEditLayerAtom, { strokes: [STROKE], at: 0 })

    expect(store.get(captureTilesetProjectAtom)?.edits.strokes).toEqual([
      STROKE
    ])
  })
})

describe('restoreTilesetProjectAtom', () => {
  it('puts the sheet back', () => {
    const store = createStore()

    store.set(restoreTilesetProjectAtom, projectOf())

    expect(store.get(tilesetSheetAtom)).toBe(SHEET)
  })

  it('puts the grid back', () => {
    const store = createStore()

    store.set(restoreTilesetProjectAtom, projectOf())

    expect(store.get(tilesetGridAtom).margin).toBe(1)
  })

  it('keeps the strokes the sheet and the grid would have dropped', () => {
    const store = createStore()

    store.set(restoreTilesetProjectAtom, projectOf())

    expect(store.get(tilesetEditLayerAtom).strokes).toEqual([STROKE])
  })

  it('keeps the frozen palette the mode change would have dropped', () => {
    const store = createStore()

    store.set(restoreTilesetProjectAtom, projectOf())

    expect(store.get(tilesetOptionsAtom).palette).toEqual([[0, 0, 0]])
  })

  it('puts the mode back', () => {
    const store = createStore()

    store.set(restoreTilesetProjectAtom, projectOf())

    expect(store.get(tilesetModeAtom)).toBe(1)
  })

  it('reads back everything it wrote', () => {
    const store = createStore()
    const project = projectOf()

    store.set(restoreTilesetProjectAtom, project)

    expect(store.get(captureTilesetProjectAtom)).toEqual(project)
  })
})
