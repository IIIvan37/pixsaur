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
    edits: {},
    layout: 'sheet',
    map: { budget: 256 },
    ...overrides
  }
}

/** The same project as version 2 wrote it: no layout, no map options. */
function version2Of(project: TilesetProject): Record<string, unknown> {
  const { layout: _layout, map: _map, ...rest } = project
  return { ...rest, edits: { strokes: [], at: -1 }, version: 2 }
}

/** A stroke as version 3 recorded it: the positions, then the pixels. */
function strokeOf(tiles: number[], x: number, pen: number) {
  return {
    tiles,
    edits: [{ x, y: 0, previousInkIndex: 0, newInkIndex: pen }],
    timestamp: 0
  }
}

/** A version 3 project, 2 px wide tiles, with its strokes and undo cursor. */
function version3Of(
  edits: { strokes: unknown[]; at: number },
  options: Record<string, unknown> = { resize: 'columns' }
): Record<string, unknown> {
  return {
    ...projectOf({ target: { tileWidth: 2, tileHeight: 1 } }),
    version: 3,
    edits,
    options
  }
}

/** Version 3, through the file. */
function parsedVersion3(...args: Parameters<typeof version3Of>) {
  const written = JSON.parse(serializeTilesetProject(projectOf()))
  const { sheet: _sheet, ...v3 } = version3Of(...args)
  const parsed = parseTilesetProject(
    JSON.stringify({ ...v3, sheet: written.sheet })
  )
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.project
}

describe('version 4', () => {
  it('lays the strokes of a version 3 project into the table', () => {
    const project = parsedVersion3({ strokes: [strokeOf([0, 2], 1, 3)], at: 0 })

    expect(project.edits).toEqual({ 0: { 1: 3 }, 2: { 1: 3 } })
  })

  it('lets the later of two strokes win on a pixel', () => {
    const project = parsedVersion3({
      strokes: [strokeOf([0], 1, 3), strokeOf([0], 1, 4)],
      at: 1
    })

    expect(project.edits).toEqual({ 0: { 1: 4 } })
  })

  it('drops the strokes a version 3 project had undone', () => {
    const project = parsedVersion3({
      strokes: [strokeOf([0], 0, 3), strokeOf([0], 1, 4)],
      at: 0
    })

    expect(project.edits).toEqual({ 0: { 0: 3 } })
  })

  it('drops the per-tile dithering of a version 3 project', () => {
    const project = parsedVersion3(
      { strokes: [], at: -1 },
      { resize: 'columns', ditherByTile: { 2: 'none' } }
    )

    expect(project.options).toEqual({ resize: 'columns' })
  })

  it('says so when a version 3 project dithered tiles of its own', () => {
    const project = parsedVersion3(
      { strokes: [], at: -1 },
      { resize: 'columns', ditherByTile: { 2: 'none' } }
    )

    expect(project.notice).toBe('tile-dither-dropped')
  })

  it('stays silent when a version 3 project dithered the sheet as one', () => {
    const project = parsedVersion3({ strokes: [], at: -1 })

    expect(project.notice).toBeUndefined()
  })

  it('migrates a version 3 project the store kept', () => {
    const stored = version3Of({ strokes: [strokeOf([1], 0, 2)], at: 0 })

    expect(readStoredTilesetProject(stored)?.edits).toEqual({ 1: { 0: 2 } })
  })

  it('refuses a version 3 project whose strokes do not read', () => {
    const written = JSON.parse(serializeTilesetProject(projectOf()))
    const { sheet: _sheet, ...v3 } = version3Of({ strokes: [{}], at: 0 })

    expect(
      parseTilesetProject(JSON.stringify({ ...v3, sheet: written.sheet }))
    ).toEqual({ ok: false, error: 'malformed' })
  })
})

describe('version 3', () => {
  it('brings the layout back through the file', () => {
    const parsed = parseTilesetProject(
      serializeTilesetProject(projectOf({ layout: 'map' }))
    )

    expect(parsed.ok && parsed.project.layout).toBe('map')
  })

  it('brings the map options back through the file', () => {
    const parsed = parseTilesetProject(
      serializeTilesetProject(projectOf({ map: { budget: 64 } }))
    )

    expect(parsed.ok && parsed.project.map).toEqual({ budget: 64 })
  })

  it('reads a version 2 file as a sheet', () => {
    const written = version2Of(JSON.parse(serializeTilesetProject(projectOf())))

    const parsed = parseTilesetProject(JSON.stringify(written))

    expect(parsed.ok && parsed.project.layout).toBe('sheet')
  })

  it('gives a version 2 file the default map options', () => {
    const written = version2Of(JSON.parse(serializeTilesetProject(projectOf())))

    const parsed = parseTilesetProject(JSON.stringify(written))

    expect(parsed.ok && parsed.project.map).toEqual({ budget: 256 })
  })

  it('stamps the migrated project with the current version', () => {
    const written = version2Of(JSON.parse(serializeTilesetProject(projectOf())))

    const parsed = parseTilesetProject(JSON.stringify(written))

    expect(parsed.ok && parsed.project.version).toBe(TILESET_PROJECT_VERSION)
  })

  it('takes back a version 2 project the store kept, as a sheet', () => {
    expect(readStoredTilesetProject(version2Of(projectOf()))?.layout).toBe(
      'sheet'
    )
  })
})

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
    const edits = { 0: { 1: 3 }, 2: { 1: 3 } }

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

  it('never writes the migration notice into the file', () => {
    const written = JSON.parse(
      serializeTilesetProject(projectOf({ notice: 'tile-dither-dropped' }))
    )

    expect(written.notice).toBeUndefined()
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

  it('drops a project whose edit layer does not read', () => {
    expect(
      readStoredTilesetProject({ ...projectOf(), edits: { 0: 'red' } })
    ).toBeNull()
  })

  it('drops a value that is not a project', () => {
    expect(readStoredTilesetProject({ nothing: true })).toBeNull()
  })
})
