import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import { setTilesetSheetAtom } from '@/app/store/tileset/tileset'
import { renderWithProviders } from '@/test-utils'
import type { TilesetSheet } from '@/tileset'
import { TilesetGridPanel } from './tileset-grid-panel'

/** A `size` x `size` sheet of solid 8 px squares, every other one repeated. */
function sheetOfAlternatingTiles(size: number): TilesetSheet {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4
      const light = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0
      data[at] = light ? 255 : 0
      data[at + 3] = 255
    }
  }
  return { width: size, height: size, data }
}

/** A store already holding an imported sheet. */
function storeWithSheet() {
  const store = createStore()
  store.set(setTilesetSheetAtom, sheetOfAlternatingTiles(64))
  return store
}

describe('TilesetGridPanel', () => {
  it('declares the tile size the grid is cut at', () => {
    renderWithProviders(<TilesetGridPanel />)

    expect(screen.getByLabelText(/Largeur de tuile/i)).toHaveValue(8)
  })

  it('cuts at the margin the user types', async () => {
    renderWithProviders(<TilesetGridPanel />)

    await userEvent.type(screen.getByLabelText(/Marge/i), '2')

    expect(screen.getByLabelText(/Marge/i)).toHaveValue(2)
  })

  it('ranks no size while no sheet is imported', () => {
    renderWithProviders(<TilesetGridPanel />)

    expect(screen.queryByRole('button', { name: '16 x 16' })).toBeNull()
  })

  it('shortlists the sizes once a sheet is in', () => {
    renderWithProviders(<TilesetGridPanel />, { store: storeWithSheet() })

    expect(screen.getByRole('button', { name: '8 x 8' })).toBeVisible()
  })

  it('cuts at a shortlisted size when it is picked', async () => {
    renderWithProviders(<TilesetGridPanel />, { store: storeWithSheet() })

    await userEvent.click(screen.getByRole('button', { name: '16 x 16' }))

    expect(screen.getByLabelText(/Largeur de tuile/i)).toHaveValue(16)
  })
})
