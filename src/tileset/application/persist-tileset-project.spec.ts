import {
  loadTilesetProject,
  saveTilesetProject
} from './persist-tileset-project'
import type { TilesetProjectStore } from './ports'
import { TILESET_PROJECT_VERSION, type TilesetProject } from './tileset-project'

function projectOf(overrides: Partial<TilesetProject> = {}): TilesetProject {
  return {
    version: TILESET_PROJECT_VERSION,
    sheet: {
      width: 1,
      height: 1,
      data: Uint8ClampedArray.from([0, 0, 0, 255])
    },
    source: { tileWidth: 1, tileHeight: 1 },
    target: { tileWidth: 1, tileHeight: 1 },
    mode: 0,
    hardware: 'classic',
    sourcePlatform: 'nes-ntsc',
    options: { resize: 'columns' },
    edits: { strokes: [], at: -1 },
    ...overrides
  }
}

function storeOf(overrides: Partial<TilesetProjectStore>): TilesetProjectStore {
  return {
    load: async () => null,
    save: async () => {},
    clear: async () => {},
    ...overrides
  }
}

describe('loadTilesetProject', () => {
  it('hands back the project the store kept', async () => {
    const project = projectOf()

    const loaded = await loadTilesetProject(
      storeOf({ load: async () => project })
    )

    expect(loaded).toEqual(project)
  })

  it('hands back nothing when the store is empty', async () => {
    expect(await loadTilesetProject(storeOf({}))).toBeNull()
  })

  it('hands back nothing when the store kept another version', async () => {
    const stale = projectOf({ version: TILESET_PROJECT_VERSION + 1 })

    expect(
      await loadTilesetProject(storeOf({ load: async () => stale }))
    ).toBeNull()
  })

  it('hands back nothing when the store is unreachable', async () => {
    const store = storeOf({
      load: async () => {
        throw new Error('no storage here')
      }
    })

    expect(await loadTilesetProject(store)).toBeNull()
  })
})

describe('saveTilesetProject', () => {
  it('writes the project to the store', async () => {
    const written: TilesetProject[] = []
    const project = projectOf()

    await saveTilesetProject(
      storeOf({
        save: async (p) => {
          written.push(p)
        }
      }),
      project
    )

    expect(written).toEqual([project])
  })

  it('reports the write it could not make', async () => {
    const store = storeOf({
      save: async () => {
        throw new Error('quota exceeded')
      }
    })

    expect(await saveTilesetProject(store, projectOf())).toBe(false)
  })

  it('reports the write it made', async () => {
    expect(await saveTilesetProject(storeOf({}), projectOf())).toBe(true)
  })
})
