import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import { setTilesetSheetAtom } from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import { TilesetSourcePanel } from './tileset-source-panel'

const SHEET = vi.hoisted(() => ({ width: 128, height: 64 }))

/** Stands in for the uploader: one click hands over a decoded image. */
vi.mock('@/components/image-upload/image-upload', () => ({
  ImageUpload: ({
    onImageLoaded
  }: {
    onImageLoaded: (img: HTMLImageElement) => void
  }) => {
    const img = new Image()
    Object.defineProperty(img, 'naturalWidth', { value: SHEET.width })
    Object.defineProperty(img, 'naturalHeight', { value: SHEET.height })
    return (
      <button type='button' onClick={() => onImageLoaded(img)}>
        Importer une planche
      </button>
    )
  }
}))

const importSheet = () =>
  userEvent.click(screen.getByRole('button', { name: /Importer une planche/i }))

/** A capture blown up twice: 8 x 2 pixels, two colours in 2 x 2 blocks. */
function captureBlownUpTwice(): Sheet {
  const data = new Uint8ClampedArray(8 * 2 * 4)
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 8; x++) {
      data[(y * 8 + x) * 4] = Math.floor(x / 2) % 2 === 0 ? 0 : 200
      data[(y * 8 + x) * 4 + 3] = 255
    }
  }
  return { width: 8, height: 2, data }
}

/** 600 pixels of 600 colours: what a bilinear filter leaves behind. */
function filteredCapture(): Sheet {
  const data = new Uint8ClampedArray(600 * 4)
  for (let x = 0; x < 600; x++) {
    data[x * 4] = x % 256
    data[x * 4 + 1] = Math.floor(x / 256)
    data[x * 4 + 3] = 255
  }
  return { width: 600, height: 1, data }
}

function storeWith(sheet: Sheet) {
  const store = createStore()
  store.set(setTilesetSheetAtom, sheet)
  return store
}

describe('TilesetSourcePanel, source checks', () => {
  it('offers to reduce a capture blown up twice', () => {
    renderWithProviders(<TilesetSourcePanel />, {
      store: storeWith(captureBlownUpTwice())
    })

    expect(screen.getByRole('status')).toHaveTextContent(/×2/)
  })

  it('brings the capture back to its own size when asked', async () => {
    renderWithProviders(<TilesetSourcePanel />, {
      store: storeWith(captureBlownUpTwice())
    })

    await userEvent.click(
      screen.getByRole('button', { name: /Réduire à la taille d'origine/i })
    )

    expect(screen.getByText('4 x 1 px')).toBeVisible()
  })

  it('warns that a capture of too many colours looks filtered', () => {
    renderWithProviders(<TilesetSourcePanel />, {
      store: storeWith(filteredCapture())
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/filtrée/i)
  })
})

describe('TilesetSourcePanel', () => {
  it('asks for a sheet while none is imported', () => {
    renderWithProviders(<TilesetSourcePanel />)

    expect(
      screen.getByRole('button', { name: /Importer une planche/i })
    ).toBeVisible()
  })

  it('reports the size of the sheet it took in', async () => {
    renderWithProviders(<TilesetSourcePanel />)

    await importSheet()

    expect(await screen.findByText('128 x 64 px')).toBeVisible()
  })

  it('takes the workshop back to the uploader when the sheet is dropped', async () => {
    renderWithProviders(<TilesetSourcePanel />)
    await importSheet()
    await screen.findByText('128 x 64 px')

    await userEvent.click(
      screen.getByRole('button', { name: /Changer de planche/i })
    )

    expect(
      screen.getByRole('button', { name: /Importer une planche/i })
    ).toBeVisible()
  })
})
