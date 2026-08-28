import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  setTilesetGridAtom,
  setTilesetModeAtom,
  setTilesetOptionsAtom,
  setTilesetSheetAtom
} from '@/app/store/tileset/tileset'
import { renderWithProviders } from '@/test-utils'
import type { TilesetSheet } from '@/tileset'
import { TilesetResultPanel } from './tileset-result-panel'

const sink = vi.hoisted(() => ({ save: vi.fn(async () => true) }))

vi.mock('@/export/application/file-sink', () => ({
  resolveFileSink: () => sink
}))

/** Two solid 8 x 8 tiles, one white and one black. */
function sheetOfTwoTiles(): TilesetSheet {
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

describe('TilesetResultPanel', () => {
  it('shows nothing while no sheet is imported', () => {
    const { container } = renderWithProviders(<TilesetResultPanel />)

    expect(container).toBeEmptyDOMElement()
  })

  it('counts the tiles the conversion kept apart', () => {
    renderWithProviders(<TilesetResultPanel />, { store: storeWithSheet() })

    expect(screen.getByLabelText(/Tuiles uniques/i)).toHaveTextContent('2 / 2')
  })

  it('hands the PNG to the file sink when the user saves it', async () => {
    renderWithProviders(<TilesetResultPanel />, { store: storeWithSheet() })

    await userEvent.click(
      screen.getByRole('button', { name: /Enregistrer le PNG/i })
    )

    expect(sink.save).toHaveBeenCalledWith(expect.any(Blob), 'tileset.png')
  })

  it('says so when the grid fits no whole tile', () => {
    const store = storeWithSheet()
    store.set(setTilesetGridAtom, { tileWidth: 64, tileHeight: 64 })

    renderWithProviders(<TilesetResultPanel />, { store })

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

    renderWithProviders(<TilesetResultPanel />, { store })

    expect(screen.getByRole('alert')).toHaveTextContent(/palette gelée/i)
  })

  it('reports no collision on a sheet the palette says exactly', () => {
    renderWithProviders(<TilesetResultPanel />, { store: storeWithSheet() })

    expect(screen.getByText(/Aucune tuile ne perd de couleur/i)).toBeVisible()
  })
})
