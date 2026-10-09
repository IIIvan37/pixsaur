import { screen } from '@testing-library/react'
import { createStore } from 'jotai'
import {
  setTilesetGridAtom,
  setTilesetLayoutAtom,
  setTilesetMapOptionsAtom,
  setTilesetSheetAtom
} from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import { TilesetInspector } from './tileset-inspector'

/** Two solid 8 x 8 tiles, one white and one black. */
function sheetOfTwoTiles(): Sheet {
  const data = new Uint8ClampedArray(16 * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const at = (y * 16 + x) * 4
      data[at] = x < 8 ? 255 : 0
      data[at + 1] = x < 8 ? 255 : 0
      data[at + 2] = x < 8 ? 255 : 0
      data[at + 3] = 255
    }
  }
  return { width: 16, height: 8, data }
}

function storeWithSheet() {
  const store = createStore()
  store.set(setTilesetSheetAtom, sheetOfTwoTiles())
  return store
}

describe('TilesetInspector', () => {
  it('counts the tiles the map keeps against its budget', () => {
    const store = storeWithSheet()
    store.set(setTilesetLayoutAtom, 'map')

    renderWithProviders(<TilesetInspector />, { store })

    expect(screen.getByLabelText(/Tuiles de la map/i)).toHaveTextContent(
      '2 / 256'
    )
  })

  it('warns when the map keeps more tiles than its budget', () => {
    const store = storeWithSheet()
    store.set(setTilesetLayoutAtom, 'map')
    store.set(setTilesetMapOptionsAtom, { budget: 1 })

    renderWithProviders(<TilesetInspector />, { store })

    expect(screen.getByRole('alert')).toHaveTextContent(/budget/i)
  })

  it('counts no map while the source is a sheet', () => {
    renderWithProviders(<TilesetInspector />, { store: storeWithSheet() })

    expect(screen.queryByLabelText(/Tuiles de la map/i)).toBeNull()
  })

  it('leaves a failed conversion to the stage', () => {
    const store = storeWithSheet()
    store.set(setTilesetGridAtom, { tileWidth: 64, tileHeight: 64 })

    renderWithProviders(<TilesetInspector />, { store })

    expect(screen.queryByLabelText(/Tuiles uniques/i)).toBeNull()
  })
})
