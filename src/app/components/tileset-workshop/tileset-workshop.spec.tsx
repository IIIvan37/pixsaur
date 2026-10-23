import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  setTilesetLayoutAtom,
  setTilesetSheetAtom,
  tilesetSettingsOpenAtom,
  tilesetSheetNameAtom
} from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import TilesetWorkshop from './tileset-workshop'

/** Two solid 8 x 8 tiles, one white and one black. */
const sheetOfTwoTiles = vi.hoisted(() => (): Sheet => {
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
})

/** Stands in for the uploader: one click hands over an image and its file. */
vi.mock('@/components/image-upload/image-upload', () => ({
  ImageUpload: ({
    onImageLoaded
  }: {
    onImageLoaded: (img: HTMLImageElement, file: File) => void
  }) => {
    const file = new File([], 'forest.png', { type: 'image/png' })
    return (
      <button type='button' onClick={() => onImageLoaded(new Image(), file)}>
        Importer une planche
      </button>
    )
  }
}))

/** happy-dom draws no canvas: the decoding has its own spec. */
vi.mock('./sheet-from-image', () => ({ sheetFromImage: sheetOfTwoTiles }))

/**
 * The workshop opens on its settings unless told otherwise. The flag is stored,
 * and `atomWithStorage` re-reads its storage on mount — so the storage is what
 * a test has to write, not the store.
 */
function renderWorkshop({ open = true, store = createStore() } = {}) {
  localStorage.setItem('tileset-settings-open', JSON.stringify(open))
  renderWithProviders(<TilesetWorkshop />, { store })
  return store
}

function storeWithSheet() {
  const store = createStore()
  store.set(setTilesetSheetAtom, sheetOfTwoTiles(), 'forest.png')
  return store
}

const stage = () => screen.getByRole('region', { name: 'Scène' })
const inspector = () => screen.getByRole('region', { name: 'Inspecteur' })

beforeEach(() => localStorage.clear())

describe('TilesetWorkshop, settings', () => {
  it('docks the settings beside the stage', () => {
    renderWorkshop()

    expect(screen.getByRole('complementary')).toBeVisible()
  })

  it('opens the docked settings on the grid', () => {
    renderWorkshop()

    expect(screen.getByRole('heading', { name: /Grille source/ })).toBeVisible()
  })

  it('offers to reopen the settings once they are closed', () => {
    renderWorkshop({ open: false })

    expect(screen.getByRole('button', { name: 'Réglages' })).toBeVisible()
  })

  it('reopens the settings from the workshop bar', async () => {
    const store = renderWorkshop({ open: false })

    await userEvent.click(screen.getByRole('button', { name: 'Réglages' }))

    expect(store.get(tilesetSettingsOpenAtom)).toBe(true)
  })
})

describe('TilesetWorkshop, bar', () => {
  it('names the file the sheet came from', () => {
    renderWorkshop({ store: storeWithSheet() })

    expect(screen.getByText('forest.png')).toBeVisible()
  })

  it('gives the size of the sheet', () => {
    renderWorkshop({ store: storeWithSheet() })

    expect(screen.getByText('16 × 8 px')).toBeVisible()
  })

  it('says how the source is read', () => {
    const store = storeWithSheet()
    store.set(setTilesetLayoutAtom, 'map')

    renderWorkshop({ store })

    expect(screen.getByText('Map', { selector: 'span' })).toBeVisible()
  })

  it('folds the project actions into one menu', () => {
    renderWorkshop()

    expect(screen.getByRole('button', { name: /Projet/ })).toBeVisible()
  })

  it('puts the Tiled export in the bar', () => {
    renderWorkshop({ store: storeWithSheet() })

    expect(
      screen.getByRole('button', { name: /Exporter pour Tiled/ })
    ).toBeEnabled()
  })
})

describe('TilesetWorkshop, empty', () => {
  it('turns the empty stage into the drop zone', () => {
    renderWorkshop()

    expect(stage()).toContainElement(
      screen.getByRole('button', { name: /Importer une planche/ })
    )
  })

  it('takes in the dropped image under its file name', async () => {
    const store = renderWorkshop()

    await userEvent.click(
      screen.getByRole('button', { name: /Importer une planche/ })
    )

    expect(store.get(tilesetSheetNameAtom)).toBe('forest.png')
  })

  it('asks the inspector for an image while none is open', () => {
    renderWorkshop()

    expect(inspector()).toHaveTextContent('Chargez une planche ou une map.')
  })
})

describe('TilesetWorkshop, stage and inspector', () => {
  // The sheet is drawn, not encoded: the preview is a canvas the workshop
  // paints, and nothing reads a PNG back (Q20).
  it('shows the converted sheet on the stage', () => {
    renderWorkshop({ store: storeWithSheet() })

    expect(stage()).toContainElement(
      screen.getByRole('img', { name: /Planche convertie/ })
    )
  })

  it('counts the tiles the conversion kept apart in the inspector', () => {
    renderWorkshop({ store: storeWithSheet() })

    expect(screen.getByLabelText(/Tuiles uniques/)).toHaveTextContent('2 / 2')
  })

  it('puts the retouching in the inspector', () => {
    renderWorkshop({ store: storeWithSheet() })

    expect(inspector()).toContainElement(
      screen.getByRole('heading', { name: /Retouche/ })
    )
  })
})
