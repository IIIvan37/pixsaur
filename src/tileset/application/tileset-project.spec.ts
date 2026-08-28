import {
  parseTilesetProject,
  readStoredTilesetProject,
  serializeTilesetProject,
  TILESET_PROJECT_VERSION,
  type TilesetProject
} from './tileset-project'

function projectOf(overrides: Partial<TilesetProject> = {}): TilesetProject {
  return {
    version: TILESET_PROJECT_VERSION,
    sheet: {
      width: 2,
      height: 1,
      data: Uint8ClampedArray.from([1, 2, 3, 255, 4, 5, 6, 255])
    },
    source: { tileWidth: 1, tileHeight: 1 },
    target: { tileWidth: 1, tileHeight: 1 },
    mode: 0,
    hardware: 'classic',
    sourcePlatform: 'nes-ntsc',
    options: { resize: 'columns', antiAlias: true },
    edits: { strokes: [], at: -1 },
    ...overrides
  }
}

describe('serializeTilesetProject', () => {
  it('brings the sheet bytes back through the file', () => {
    const text = serializeTilesetProject(projectOf())

    const parsed = parseTilesetProject(text)

    expect(parsed.ok && Array.from(parsed.project.sheet.data)).toEqual([
      1, 2, 3, 255, 4, 5, 6, 255
    ])
  })

  it('brings the sheet size back through the file', () => {
    const text = serializeTilesetProject(projectOf())

    const parsed = parseTilesetProject(text)

    expect(parsed.ok && parsed.project.sheet.width).toBe(2)
  })

  it('brings the edit layer back through the file', () => {
    const edits = {
      strokes: [
        {
          tiles: [0, 2],
          edits: [{ x: 0, y: 0, previousInkIndex: 0, newInkIndex: 3 }],
          timestamp: 12
        }
      ],
      at: 0
    }

    const parsed = parseTilesetProject(
      serializeTilesetProject(projectOf({ edits }))
    )

    expect(parsed.ok && parsed.project.edits).toEqual(edits)
  })

  it('brings a frozen palette back through the file', () => {
    const palette: [number, number, number][] = [
      [0, 0, 0],
      [255, 0, 255]
    ]

    const parsed = parseTilesetProject(
      serializeTilesetProject(
        projectOf({ options: { resize: 'columns', palette } })
      )
    )

    expect(parsed.ok && parsed.project.options.palette).toEqual(palette)
  })

  it('survives a sheet larger than one call stack', () => {
    const data = new Uint8ClampedArray(400 * 400 * 4).fill(7)

    const parsed = parseTilesetProject(
      serializeTilesetProject(
        projectOf({ sheet: { width: 400, height: 400, data } })
      )
    )

    expect(parsed.ok && parsed.project.sheet.data.length).toBe(400 * 400 * 4)
  })
})

describe('parseTilesetProject', () => {
  it('refuses text that is not JSON', () => {
    expect(parseTilesetProject('not a project')).toEqual({
      ok: false,
      error: 'invalid-json'
    })
  })

  it('refuses a file written by another version', () => {
    const text = JSON.stringify({
      ...JSON.parse(serializeTilesetProject(projectOf())),
      version: TILESET_PROJECT_VERSION + 1
    })

    expect(parseTilesetProject(text)).toEqual({
      ok: false,
      error: 'unsupported-version'
    })
  })

  it('refuses a file whose sheet is missing', () => {
    const { sheet: _dropped, ...rest } = JSON.parse(
      serializeTilesetProject(projectOf())
    )

    expect(parseTilesetProject(JSON.stringify(rest))).toEqual({
      ok: false,
      error: 'malformed'
    })
  })

  it('refuses a sheet whose bytes do not fill its size', () => {
    const written = JSON.parse(serializeTilesetProject(projectOf()))
    written.sheet.width = 3

    expect(parseTilesetProject(JSON.stringify(written))).toEqual({
      ok: false,
      error: 'malformed'
    })
  })
})

describe('readStoredTilesetProject', () => {
  it('takes back what the structured clone kept', () => {
    const project = projectOf()

    expect(readStoredTilesetProject(project)?.sheet.data).toEqual(
      project.sheet.data
    )
  })

  it('drops a project left by another version', () => {
    expect(
      readStoredTilesetProject(
        projectOf({ version: TILESET_PROJECT_VERSION + 1 })
      )
    ).toBeNull()
  })

  it('drops a value that is not a project', () => {
    expect(readStoredTilesetProject({ nothing: true })).toBeNull()
  })
})
