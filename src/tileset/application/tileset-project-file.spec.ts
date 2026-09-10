import type { FileSink } from '@/export/application/ports'
import {
  parseTilesetProject,
  serializeTilesetProject,
  TILESET_PROJECT_VERSION,
  type TilesetProject
} from './tileset-project'
import {
  exportTilesetProjectFile,
  importTilesetProjectFile,
  TILESET_PROJECT_FILENAME
} from './tileset-project-file'

function projectOf(overrides: Partial<TilesetProject> = {}): TilesetProject {
  return {
    version: TILESET_PROJECT_VERSION,
    sheet: { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) },
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

function fakeFileSink(ok = true) {
  const save = vi.fn(async (_blob: Blob, _filename: string) => ok)
  return { sink: { save } as FileSink, save }
}

/** A file whose bytes the browser refuses to hand over. */
function unreadableFile(): Blob {
  return { text: () => Promise.reject(new Error('gone')) } as Blob
}

describe('exportTilesetProjectFile', () => {
  it('hands the file to the sink under the project name', async () => {
    const { save, sink } = fakeFileSink()

    await exportTilesetProjectFile({ project: projectOf() }, { fileSink: sink })

    expect(save).toHaveBeenCalledWith(
      expect.any(Blob),
      TILESET_PROJECT_FILENAME
    )
  })

  it('writes a file that reads back as the same project', async () => {
    const { save, sink } = fakeFileSink()

    await exportTilesetProjectFile({ project: projectOf() }, { fileSink: sink })

    const written = await save.mock.calls[0][0].text()
    expect(parseTilesetProject(written)).toMatchObject({ ok: true })
  })

  it('reports the success back', async () => {
    const result = await exportTilesetProjectFile(
      { project: projectOf() },
      { fileSink: fakeFileSink().sink }
    )

    expect(result).toEqual({ ok: true })
  })

  it('names the failure when the sink cannot write', async () => {
    const sink: FileSink = { save: () => Promise.reject(new Error('full')) }

    const result = await exportTilesetProjectFile(
      { project: projectOf() },
      { fileSink: sink }
    )

    expect(result).toEqual({ ok: false, error: 'save-failed' })
  })
})

describe('importTilesetProjectFile', () => {
  it('gives the project back', async () => {
    const file = new Blob([serializeTilesetProject(projectOf())])

    const result = await importTilesetProjectFile({ file })

    expect(result).toMatchObject({ ok: true })
  })

  it('keeps what the project carried', async () => {
    const file = new Blob([serializeTilesetProject(projectOf())])

    const result = await importTilesetProjectFile({ file })

    expect(result.ok && result.project.source.margin).toBe(2)
  })

  it('names a file that is not JSON', async () => {
    const result = await importTilesetProjectFile({ file: new Blob(['nope']) })

    expect(result).toEqual({ ok: false, error: 'invalid-json' })
  })

  it('names a project from another version', async () => {
    const written = JSON.parse(serializeTilesetProject(projectOf()))
    written.version = TILESET_PROJECT_VERSION + 1

    const result = await importTilesetProjectFile({
      file: new Blob([JSON.stringify(written)])
    })

    expect(result).toEqual({ ok: false, error: 'unsupported-version' })
  })

  it('names a file the browser will not read', async () => {
    const result = await importTilesetProjectFile({ file: unreadableFile() })

    expect(result).toEqual({ ok: false, error: 'unreadable-file' })
  })
})
