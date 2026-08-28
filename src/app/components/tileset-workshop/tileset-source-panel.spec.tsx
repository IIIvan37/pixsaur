import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
