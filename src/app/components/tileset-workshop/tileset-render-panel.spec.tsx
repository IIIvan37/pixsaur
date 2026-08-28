import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  setTilesetOptionsAtom,
  setTilesetSheetAtom,
  tilesetOptionsAtom
} from '@/app/store/tileset/tileset'
import { renderWithProviders } from '@/test-utils'
import type { TilesetSheet } from '@/tileset'
import { TilesetRenderPanel } from './tileset-render-panel'

/** Two solid 8 x 8 tiles — enough for the conversion to run a real resize. */
function sheetOfTwoTiles(): TilesetSheet {
  const data = new Uint8ClampedArray(16 * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const at = (y * 16 + x) * 4
      data[at] = x < 8 ? 255 : 0
      data[at + 3] = 255
    }
  }
  return { width: 16, height: 8, data }
}

describe('TilesetRenderPanel', () => {
  it('leaves the tiles untramed until the user asks for it', () => {
    const { store } = renderWithProviders(<TilesetRenderPanel />)

    expect(store.get(tilesetOptionsAtom).dither).toBe('none')
  })

  it('closes the Bayer matrix while the dithering is not ordered', () => {
    renderWithProviders(<TilesetRenderPanel />)

    expect(
      screen.getByRole('combobox', { name: /Matrice de Bayer/i })
    ).toBeDisabled()
  })

  it('opens the Bayer matrix once the dithering is ordered', () => {
    const store = createStore()
    store.set(setTilesetOptionsAtom, { dither: 'ordered' })

    renderWithProviders(<TilesetRenderPanel />, { store })

    expect(
      screen.getByRole('combobox', { name: /Matrice de Bayer/i })
    ).not.toBeDisabled()
  })

  it('softens the staircases until the user says otherwise', () => {
    renderWithProviders(<TilesetRenderPanel />)

    expect(screen.getByLabelText(/Adoucir les escaliers/i)).toBeChecked()
  })

  it('leaves the staircases alone when the user unticks it', async () => {
    const { store } = renderWithProviders(<TilesetRenderPanel />)

    await userEvent.click(screen.getByLabelText(/Adoucir les escaliers/i))

    expect(store.get(tilesetOptionsAtom).antiAlias).toBe(false)
  })

  it('says nothing about a search while no sheet is converted', () => {
    renderWithProviders(<TilesetRenderPanel />)

    expect(screen.queryByText(/Recherche/i)).toBeNull()
  })

  it('says the search was exhaustive when it was', () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfTwoTiles())

    renderWithProviders(<TilesetRenderPanel />, { store })

    expect(screen.getByText(/Recherche exhaustive/i)).toBeVisible()
  })
})
