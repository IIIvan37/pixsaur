import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import { setTilesetSheetAtom } from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import { TilesetExportButtons } from './tileset-export-buttons'

const sink = vi.hoisted(() => ({ save: vi.fn(async () => true) }))

vi.mock('@/export/application/file-sink', () => ({
  resolveFileSink: () => sink
}))

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

describe('TilesetExportButtons', () => {
  it('has nothing to save before a sheet is imported', () => {
    renderWithProviders(<TilesetExportButtons />)

    expect(
      screen.getByRole('button', { name: /Enregistrer le PNG/i })
    ).toBeDisabled()
  })

  it('has nothing to export before a sheet is imported', () => {
    renderWithProviders(<TilesetExportButtons />)

    expect(
      screen.getByRole('button', { name: /Exporter pour Tiled/i })
    ).toBeDisabled()
  })

  it('hands the PNG to the file sink when the user saves it', async () => {
    renderWithProviders(<TilesetExportButtons />, { store: storeWithSheet() })

    await userEvent.click(
      screen.getByRole('button', { name: /Enregistrer le PNG/i })
    )

    expect(sink.save).toHaveBeenCalledWith(expect.any(Blob), 'tileset.png')
  })

  it('hands one Tiled archive to the file sink when the user exports', async () => {
    renderWithProviders(<TilesetExportButtons />, { store: storeWithSheet() })

    await userEvent.click(
      screen.getByRole('button', { name: /Exporter pour Tiled/i })
    )

    // The archive is zipped asynchronously, after the click has settled.
    await waitFor(() =>
      expect(sink.save).toHaveBeenCalledWith(
        expect.any(Blob),
        'tileset-tiled.zip'
      )
    )
  })
})
