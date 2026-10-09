import { screen } from '@testing-library/react'
import { createStore } from 'jotai'
import {
  setTilesetGridAtom,
  setTilesetModeAtom,
  setTilesetOptionsAtom,
  setTilesetSheetAtom
} from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import { TilesetStage } from './tileset-stage'

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

describe('TilesetStage', () => {
  it('says so when the grid fits no whole tile', () => {
    const store = storeWithSheet()
    store.set(setTilesetGridAtom, { tileWidth: 64, tileHeight: 64 })

    renderWithProviders(<TilesetStage />, { store })

    expect(screen.getByRole('alert')).toHaveTextContent(/grille déclarée/i)
  })

  it('says so when the frozen palette is wider than the mode', () => {
    const store = storeWithSheet()
    store.set(setTilesetModeAtom, 2)
    store.set(setTilesetOptionsAtom, {
      transparency: 'flatten',
      palette: [
        [0, 0, 0],
        [255, 255, 255],
        [255, 0, 0]
      ]
    })

    renderWithProviders(<TilesetStage />, { store })

    expect(screen.getByRole('alert')).toHaveTextContent(/palette gelée/i)
  })
})
