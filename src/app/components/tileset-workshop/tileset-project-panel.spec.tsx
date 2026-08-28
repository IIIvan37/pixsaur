import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  setTilesetSheetAtom,
  tilesetGridAtom,
  tilesetSheetAtom
} from '@/app/store/tileset/tileset'
import { renderWithProviders } from '@/test-utils'
import {
  serializeTilesetProject,
  TILESET_PROJECT_VERSION,
  type TilesetProject,
  type TilesetSheet
} from '@/tileset'
import { TilesetProjectPanel } from './tileset-project-panel'

const sink = vi.hoisted(() => ({ save: vi.fn(async () => true) }))

vi.mock('@/export/application/file-sink', () => ({
  resolveFileSink: () => sink
}))

/** One solid 8 x 8 tile. */
function sheetOfOneTile(): TilesetSheet {
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
    edits: { strokes: [], at: -1 },
    ...overrides
  }
}

function fileOf(content: string): File {
  return new File([content], 'project.json', { type: 'application/json' })
}

beforeEach(() => {
  sink.save.mockClear()
})

describe('TilesetProjectPanel', () => {
  it('has nothing to export before a sheet is imported', () => {
    renderWithProviders(<TilesetProjectPanel />, { store: createStore() })

    expect(screen.getByRole('button', { name: /Exporter/ })).toBeDisabled()
  })

  it('exports the project as a file', async () => {
    const store = createStore()
    store.set(setTilesetSheetAtom, sheetOfOneTile())
    renderWithProviders(<TilesetProjectPanel />, { store })

    await userEvent.click(screen.getByRole('button', { name: /Exporter/ }))

    expect(sink.save).toHaveBeenCalledWith(
      expect.any(Blob),
      'tileset-project.json'
    )
  })

  it('puts an imported project back in the workshop', async () => {
    const store = createStore()
    renderWithProviders(<TilesetProjectPanel />, { store })

    await userEvent.upload(
      screen.getByLabelText(/Importer/),
      fileOf(serializeTilesetProject(projectOf()))
    )

    await waitFor(() => expect(store.get(tilesetGridAtom).margin).toBe(2))
  })

  it('says so when the file is not a project', async () => {
    const store = createStore()
    renderWithProviders(<TilesetProjectPanel />, { store })

    await userEvent.upload(screen.getByLabelText(/Importer/), fileOf('nope'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/pas un projet/)
  })

  it('leaves the workshop untouched when the file is refused', async () => {
    const store = createStore()
    renderWithProviders(<TilesetProjectPanel />, { store })

    await userEvent.upload(screen.getByLabelText(/Importer/), fileOf('nope'))

    await screen.findByRole('alert')
    expect(store.get(tilesetSheetAtom)).toBeNull()
  })

  it('says so when the project comes from another version', async () => {
    const store = createStore()
    renderWithProviders(<TilesetProjectPanel />, { store })
    const written = JSON.parse(serializeTilesetProject(projectOf()))
    written.version = TILESET_PROJECT_VERSION + 1

    await userEvent.upload(
      screen.getByLabelText(/Importer/),
      fileOf(JSON.stringify(written))
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/autre version/)
  })
})
