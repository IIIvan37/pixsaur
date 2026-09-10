import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  selectedTileAtom,
  setTilesetLayoutAtom,
  setTilesetMapOptionsAtom,
  setTilesetSheetAtom,
  tilesetMapAtom
} from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import { EMPTY_CELL } from '@/tileset'
import { TilesetMapView } from './tileset-map-view'

/** A map of one row: a white cell, a black one, a white one again. */
function mapOfThreeCells(): Sheet {
  const width = 3 * 8
  const data = new Uint8ClampedArray(width * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const white = Math.floor(x / 8) !== 1
      data[at] = white ? 255 : 0
      data[at + 1] = white ? 255 : 0
      data[at + 2] = white ? 255 : 0
      data[at + 3] = 255
    }
  }
  return { width, height: 8, data }
}

function storeWithMap() {
  const store = createStore()
  store.set(setTilesetSheetAtom, mapOfThreeCells())
  store.set(setTilesetLayoutAtom, 'map')
  return store
}

/** The page lays the map out 24 x 8 px from the top-left corner. */
function layOutMap() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 24,
    height: 8
  } as DOMRect)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TilesetMapView', () => {
  it('shows the converted map first', () => {
    renderWithProviders(<TilesetMapView />, { store: storeWithMap() })

    expect(screen.getByRole('img', { name: /Map convertie/i })).toBeVisible()
  })

  it('shows the tiles the map keeps on their own tab', async () => {
    renderWithProviders(<TilesetMapView />, { store: storeWithMap() })

    await userEvent.click(screen.getByRole('tab', { name: /Tileset/i }))

    expect(
      screen.getByRole('img', { name: /Tileset de la map/i })
    ).toBeVisible()
  })

  it('shows the source in place of the result when the user compares', async () => {
    renderWithProviders(<TilesetMapView />, { store: storeWithMap() })

    await userEvent.click(
      screen.getByRole('button', { name: /Comparer avec la source/i })
    )

    expect(screen.getByRole('img', { name: /Map source/i })).toBeVisible()
  })

  // M-Q16: hovering a cell shows every cell that holds the same tile.
  it('names the tile under the pointer and the cells that show it', () => {
    layOutMap()
    renderWithProviders(<TilesetMapView />, { store: storeWithMap() })

    fireEvent.mouseMove(screen.getByRole('img', { name: /Map convertie/i }), {
      clientX: 4,
      clientY: 4
    })

    expect(screen.getByLabelText(/Case survolée/i)).toHaveTextContent(
      'Tuile 1 · 2 cases'
    )
  })

  // M-Q13: the user names the tile that becomes Tiled's GID 0.
  it('empties the tile of the cell the user picked', async () => {
    layOutMap()
    const store = storeWithMap()
    renderWithProviders(<TilesetMapView />, { store })
    fireEvent.click(screen.getByRole('img', { name: /Map convertie/i }), {
      clientX: 12,
      clientY: 4
    })

    await userEvent.click(
      screen.getByRole('button', { name: /Vider la tuile de la case/i })
    )

    expect(store.get(tilesetMapAtom)?.cells).toEqual([0, EMPTY_CELL, 0])
  })

  it('says a cell under the pointer is empty', async () => {
    layOutMap()
    const store = storeWithMap()
    store.set(setTilesetMapOptionsAtom, { emptyTile: 1 })
    renderWithProviders(<TilesetMapView />, { store })

    fireEvent.mouseMove(screen.getByRole('img', { name: /Map convertie/i }), {
      clientX: 12,
      clientY: 4
    })

    expect(screen.getByLabelText(/Case survolée/i)).toHaveTextContent(
      /Case vide/
    )
  })

  it('leaves every cell a tile when the user asks for no empty tile', async () => {
    const store = storeWithMap()
    store.set(setTilesetMapOptionsAtom, { emptyTile: 1 })
    renderWithProviders(<TilesetMapView />, { store })

    await userEvent.click(
      screen.getByRole('button', { name: /Aucune tuile vide/i })
    )

    expect(store.get(tilesetMapAtom)?.cells).toEqual([0, 1, 0])
  })

  it('aims the retouching at the cell the user clicks', () => {
    layOutMap()
    const store = storeWithMap()
    renderWithProviders(<TilesetMapView />, { store })

    fireEvent.click(screen.getByRole('img', { name: /Map convertie/i }), {
      clientX: 12,
      clientY: 4
    })

    expect(store.get(selectedTileAtom)).toBe(1)
  })
})
