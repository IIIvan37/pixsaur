import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  restoreTilesetProjectAtom,
  setTilesetSheetAtom,
  tilesetGridAtom,
  tilesetSheetAtom
} from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import {
  serializeTilesetProject,
  TILESET_PROJECT_VERSION,
  type TilesetProject
} from '@/tileset'
import { TilesetProjectMenu } from './tileset-project-menu'

const sink = vi.hoisted(() => ({ save: vi.fn(async () => true) }))

vi.mock('@/export/application/file-sink', () => ({
  resolveFileSink: () => sink
}))

/** One solid 8 x 8 tile. */
function sheetOfOneTile(): Sheet {
  return {
    width: 8,
    height: 8,
    data: new Uint8ClampedArray(8 * 8 * 4).fill(255)
  }
}

function projectOf(overrides: Partial<TilesetProject> = {}): TilesetProject {
  return {
    version: TILESET_PROJECT_VERSION,
    sheet: sheetOfOneTile(),
    source: { tileWidth: 8, tileHeight: 8, margin: 2 },
    target: { tileWidth: 8, tileHeight: 8 },
    mode: 0,
    hardware: 'classic',
    sourcePlatform: 'nes-ntsc',
    options: { resize: 'columns' },
    edits: {},
    layout: 'sheet',
    map: { budget: 256 },
    ...overrides
  }
}

const openMenu = () =>
  userEvent.click(screen.getByRole('button', { name: /Projet/ }))

function fileOf(content: string): File {
  return new File([content], 'project.json', { type: 'application/json' })
}

beforeEach(() => {
  sink.save.mockClear()
})

describe('TilesetProjectMenu', () => {
  it('has nothing to export before a sheet is imported', async () => {
    renderWithProviders(<TilesetProjectMenu />, { store: createStore() })

    await openMenu()

    expect(screen.getByRole('button', { name: /Exporter/ })).toBeDisabled()
  })

  it('exports the project as a file', async () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfOneTile())
    renderWithProviders(<TilesetProjectMenu />, { store })
    await openMenu()

    await userEvent.click(screen.getByRole('button', { name: /Exporter/ }))

    expect(sink.save).toHaveBeenCalledWith(
      expect.any(Blob),
      'tileset-project.json'
    )
  })

  it('puts an imported project back in the workshop', async () => {
    const store = createStore()
    renderWithProviders(<TilesetProjectMenu />, { store })

    await userEvent.upload(
      screen.getByLabelText(/Importer/),
      fileOf(serializeTilesetProject(projectOf()))
    )

    await waitFor(() => expect(store.get(tilesetGridAtom).margin).toBe(2))
  })

  it('says so when the file is not a project', async () => {
    const store = createStore()
    renderWithProviders(<TilesetProjectMenu />, { store })

    await userEvent.upload(screen.getByLabelText(/Importer/), fileOf('nope'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/pas un projet/)
  })

  it('leaves the workshop untouched when the file is refused', async () => {
    const store = createStore()
    renderWithProviders(<TilesetProjectMenu />, { store })

    await userEvent.upload(screen.getByLabelText(/Importer/), fileOf('nope'))

    await screen.findByRole('alert')
    expect(store.get(tilesetSheetAtom)).toBeNull()
  })

  it('has no image to change before a sheet is imported', async () => {
    renderWithProviders(<TilesetProjectMenu />, { store: createStore() })

    await openMenu()

    expect(
      screen.getByRole('button', { name: /Changer d'image/ })
    ).toBeDisabled()
  })

  it('takes the workshop back to the drop zone on another image', async () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfOneTile())
    renderWithProviders(<TilesetProjectMenu />, { store })
    await openMenu()

    await userEvent.click(
      screen.getByRole('button', { name: /Changer d'image/ })
    )

    expect(store.get(tilesetSheetAtom)).toBeNull()
  })

  it('says once that the per-tile dithering is gone', () => {
    const store = createStore()
    store.set(
      restoreTilesetProjectAtom,
      projectOf({ notice: 'tile-dither-dropped' })
    )

    renderWithProviders(<TilesetProjectMenu />, { store })

    expect(screen.getByRole('status')).toHaveTextContent(/tuile par tuile/)
  })

  it('puts the notice away once read', async () => {
    const store = createStore()
    store.set(
      restoreTilesetProjectAtom,
      projectOf({ notice: 'tile-dither-dropped' })
    )
    renderWithProviders(<TilesetProjectMenu />, { store })

    await userEvent.click(screen.getByRole('button', { name: /Compris/ }))

    expect(screen.queryByRole('status')).toBeNull()
  })
})
