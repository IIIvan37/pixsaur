import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  setTilesetModeAtom,
  setTilesetSheetAtom,
  tilesetOptionsAtom
} from '@/app/store/tileset/tileset'
import { renderWithProviders } from '@/test-utils'
import type { TilesetSheet } from '@/tileset'
import { TilesetPalettePanel } from './tileset-palette-panel'

/** Two solid 8 x 8 tiles, black and white — enough to choose pens over. */
function sheetOfTwoTiles(): TilesetSheet {
  const data = new Uint8ClampedArray(16 * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const at = (y * 16 + x) * 4
      const light = x < 8
      data[at] = light ? 255 : 0
      data[at + 1] = light ? 255 : 0
      data[at + 2] = light ? 255 : 0
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

describe('TilesetPalettePanel', () => {
  it('shows no palette grid before a sheet is converted', () => {
    renderWithProviders(<TilesetPalettePanel />, { store: createStore() })

    expect(screen.queryByLabelText(/Palette du tileset/)).toBeNull()
  })

  it('shows the converted palette pen by pen', () => {
    renderWithProviders(<TilesetPalettePanel />, { store: storeWithSheet() })

    expect(screen.getByLabelText(/Palette du tileset/)).toBeVisible()
  })

  it('keeps no pen reserved until the user asks for one', () => {
    renderWithProviders(<TilesetPalettePanel />)

    expect(screen.getByLabelText(/Pens réservés/i)).toHaveValue(0)
  })

  it('reserves the pens the sprites were promised', async () => {
    renderWithProviders(<TilesetPalettePanel />)

    await userEvent.type(screen.getByLabelText(/Pens réservés/i), '4')

    expect(screen.getByLabelText(/Pens réservés/i)).toHaveValue(4)
  })

  it('closes the reservation in a mode with no pen to spare', () => {
    const store = createStore()
    store.set(setTilesetModeAtom, 1)

    renderWithProviders(<TilesetPalettePanel />, { store })

    expect(screen.getByLabelText(/Pens réservés/i)).toBeDisabled()
  })

  it('leaves the palette to the strategy until it is frozen', () => {
    renderWithProviders(<TilesetPalettePanel />)

    expect(screen.getByLabelText(/Geler la palette/i)).not.toBeChecked()
  })

  it('pins the palette the conversion chose when it is frozen', async () => {
    const { store } = renderWithProviders(<TilesetPalettePanel />, {
      store: storeWithSheet()
    })

    await userEvent.click(screen.getByLabelText(/Geler la palette/i))

    expect(store.get(tilesetOptionsAtom).palette).toBeDefined()
  })

  it('hands the palette back to the strategy when it is thawed', async () => {
    const { store } = renderWithProviders(<TilesetPalettePanel />, {
      store: storeWithSheet()
    })
    await userEvent.click(screen.getByLabelText(/Geler la palette/i))

    await userEvent.click(screen.getByLabelText(/Geler la palette/i))

    expect(store.get(tilesetOptionsAtom).palette).toBeUndefined()
  })
})
