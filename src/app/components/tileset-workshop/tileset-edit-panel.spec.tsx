import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  editedTilesetAtom,
  setTileDitherAtom,
  setTilesetSheetAtom,
  tilesetEditLayerAtom
} from '@/app/store/tileset/tileset'
import { renderWithProviders } from '@/test-utils'
import type { TilesetSheet } from '@/tileset'
import { TilesetEditPanel } from './tileset-edit-panel'

/** Four colours over eight solid 8 x 8 tiles: every tile has one twin. */
const COLOURS: [number, number, number][] = [
  [0, 0, 0],
  [255, 255, 255],
  [255, 0, 0],
  [0, 255, 0]
]

function sheetOfRepeatedColours(): TilesetSheet {
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

/** A store holding the sheet the panel needs to show anything. */
function storeWithSheet() {
  const store = createStore()
  store.set(setTilesetSheetAtom, sheetOfRepeatedColours())
  return store
}

/** The pen standing at the top-left of the first tile. */
function firstPen(store: ReturnType<typeof createStore>): number {
  const result = store.get(editedTilesetAtom)
  if (!result?.ok) throw new Error('the conversion failed')
  return result.tileset.tiles[0].indices[0]
}

describe('TilesetEditPanel', () => {
  it('shows nothing while no sheet is imported', () => {
    renderWithProviders(<TilesetEditPanel />)

    expect(screen.queryByRole('heading', { name: /Retouche/i })).toBeNull()
  })

  it('paints the chosen pen into the clicked pixel', async () => {
    const store = storeWithSheet()
    renderWithProviders(<TilesetEditPanel />, { store })

    await userEvent.click(screen.getByRole('button', { name: /^Pen 3$/i }))
    await userEvent.click(screen.getByRole('button', { name: /Pixel 0, 0/i }))

    expect(firstPen(store)).toBe(3)
  })

  it('says how many instances the stroke will reach', () => {
    const store = storeWithSheet()

    renderWithProviders(<TilesetEditPanel />, { store })

    expect(screen.getByLabelText(/Instances/i)).toHaveTextContent('2')
  })

  it('undoes the last stroke', async () => {
    const store = storeWithSheet()
    renderWithProviders(<TilesetEditPanel />, { store })

    await userEvent.click(screen.getByRole('button', { name: /^Pen 3$/i }))
    await userEvent.click(screen.getByRole('button', { name: /Pixel 0, 0/i }))
    await userEvent.click(
      screen.getByRole('button', { name: /Annuler \(Ctrl\+Z\)/i })
    )

    expect(store.get(tilesetEditLayerAtom).at).toBe(-1)
  })

  it('closes the undo while nothing is painted', () => {
    renderWithProviders(<TilesetEditPanel />, { store: storeWithSheet() })

    expect(
      screen.getByRole('button', { name: /Annuler \(Ctrl\+Z\)/i })
    ).toBeDisabled()
  })

  it('redoes the undone stroke', async () => {
    const store = storeWithSheet()
    renderWithProviders(<TilesetEditPanel />, { store })

    await userEvent.click(screen.getByRole('button', { name: /^Pen 3$/i }))
    await userEvent.click(screen.getByRole('button', { name: /Pixel 0, 0/i }))
    await userEvent.click(
      screen.getByRole('button', { name: /Annuler \(Ctrl\+Z\)/i })
    )
    await userEvent.click(screen.getByRole('button', { name: /Refaire/i }))

    expect(firstPen(store)).toBe(3)
  })

  it('undoes at the keyboard, as the button promises', async () => {
    const store = storeWithSheet()
    renderWithProviders(<TilesetEditPanel />, { store })

    await userEvent.click(screen.getByRole('button', { name: /^Pen 3$/i }))
    await userEvent.click(screen.getByRole('button', { name: /Pixel 0, 0/i }))
    await userEvent.keyboard('{Control>}z{/Control}')

    expect(store.get(tilesetEditLayerAtom).at).toBe(-1)
  })

  it('shows the dithering the tile was given', () => {
    const store = storeWithSheet()
    store.set(setTileDitherAtom, { tile: 0, dither: 'ordered' })

    renderWithProviders(<TilesetEditPanel />, { store })

    expect(
      screen.getByRole('combobox', { name: /Tramage de la tuile/i })
    ).toHaveTextContent(/Ordonné/i)
  })
})
