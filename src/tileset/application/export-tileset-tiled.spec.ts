import JSZip from 'jszip'
import type { CanvasFactory, FileSink } from '@/export/application/ports'
import type { ConvertedTileset } from './convert-tileset'
import {
  type ExportTilesetTiledInput,
  exportTilesetTiled
} from './export-tileset-tiled'
import type { Pen } from './pens'
import { mapTileset } from './tileset-map'

const WHITE: Pen = [255, 255, 255]
const BLACK: Pen = [0, 0, 0]
const RED: Pen = [255, 0, 0]

/** Two tiles of 4 x 2 CPC pixels side by side: one black, one white. */
function tilesetOfTwo(palette = [BLACK, WHITE]): ConvertedTileset {
  return {
    columns: 2,
    rows: 1,
    palette,
    tiles: [
      { indices: new Uint8Array(8) },
      { indices: new Uint8Array(8).fill(1) }
    ],
    instanceOf: [0, 1],
    unique: [0, 1],
    transparentPen: null,
    collisions: [],
    resizeSearch: null
  }
}

function input(
  overrides: Partial<ExportTilesetTiledInput> = {}
): ExportTilesetTiledInput {
  return {
    tileset: tilesetOfTwo(),
    target: { tileWidth: 4, tileHeight: 2 },
    mode: 0,
    hardware: 'classic',
    ...overrides
  }
}

function fakeCanvasFactory() {
  const canvas = {
    getContext: () => ({ putImageData: vi.fn() }),
    toBlob: (done: (blob: Blob | null) => void) => done(new Blob(['png']))
  } as unknown as HTMLCanvasElement
  const factory: CanvasFactory = { createCanvas: vi.fn(() => canvas) }
  return factory
}

function contextlessCanvasFactory(): CanvasFactory {
  const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
  return { createCanvas: () => canvas }
}

function fakeFileSink() {
  const save = vi.fn(async (_blob: Blob, _name: string) => true)
  return { sink: { save } as FileSink, save }
}

/** Runs the export and hands back what the sink received. */
async function exported(overrides: Partial<ExportTilesetTiledInput> = {}) {
  const { sink, save } = fakeFileSink()
  const canvasFactory = fakeCanvasFactory()
  const result = await exportTilesetTiled(input(overrides), {
    canvasFactory,
    fileSink: sink
  })
  const [blob, filename] = save.mock.calls[0] ?? []
  return { result, blob, filename, canvasFactory }
}

async function readEntry(blob: Blob | undefined, name: string) {
  const zip = await JSZip.loadAsync(blob as Blob)
  return zip.file(name)?.async('string')
}

async function tsxOf(overrides: Partial<ExportTilesetTiledInput> = {}) {
  const { blob } = await exported(overrides)
  return readEntry(blob, 'tileset.tsx')
}

describe('exportTilesetTiled', () => {
  it('hands one archive to the sink under the Tiled name', async () => {
    const { filename } = await exported()

    expect(filename).toBe('tileset-tiled.zip')
  })

  it('reports the success back', async () => {
    const { result } = await exported()

    expect(result).toEqual({ ok: true })
  })

  it('packs the tileset description and its image', async () => {
    const { blob } = await exported()
    const zip = await JSZip.loadAsync(blob as Blob)

    expect(Object.keys(zip.files).sort()).toEqual([
      'tileset.png',
      'tileset.tsx'
    ])
  })

  it('points the description at the image next to it', async () => {
    expect(await tsxOf()).toContain('source="tileset.png"')
  })

  // Pre-stretched (M-Q11): a mode 0 pixel is drawn two pixels wide, so Tiled
  // shows the tile with the shape it has on a CPC screen.
  it('sizes a tile in stretched pixels', async () => {
    expect(await tsxOf()).toContain('tilewidth="8" tileheight="2"')
  })

  it('draws the image without gutters, in stretched pixels', async () => {
    const { canvasFactory } = await exported()

    expect(canvasFactory.createCanvas).toHaveBeenCalledWith(16, 2)
  })

  // M-Q20: the GID of a tile is its position in the source sheet.
  it('keeps the column count of the source sheet', async () => {
    expect(await tsxOf()).toContain('columns="2"')
  })

  it('counts every tile of the sheet', async () => {
    expect(await tsxOf()).toContain('tilecount="2"')
  })

  it('names the mode the tiles were converted for', async () => {
    expect(await tsxOf()).toContain(
      '<property name="cpcMode" type="int" value="0"/>'
    )
  })

  it('gives the classic palette as firmware ink numbers', async () => {
    expect(await tsxOf()).toContain('<property name="palette" value="0,26"/>')
  })

  it('gives the Plus palette as ASIC words, green first', async () => {
    expect(
      await tsxOf({
        hardware: 'plus',
        tileset: tilesetOfTwo([RED, WHITE])
      })
    ).toContain('<property name="palette" value="0F0,FFF"/>')
  })

  it('gives the palette as RGB too, whatever the hardware', async () => {
    expect(await tsxOf()).toContain(
      '<property name="paletteRgb" value="#000000,#FFFFFF"/>'
    )
  })

  it('names the failure when the browser gives no 2d context', async () => {
    const result = await exportTilesetTiled(input(), {
      canvasFactory: contextlessCanvasFactory(),
      fileSink: fakeFileSink().sink
    })

    expect(result).toEqual({ ok: false, error: 'no-canvas-context' })
  })
})

/** Tiles of 4 x 2 CPC pixels on one row, one pen each — a map of one line. */
function tilesetOfPens(pens: number[]): ConvertedTileset {
  const colours = Math.max(...pens) + 1
  return {
    columns: pens.length,
    rows: 1,
    palette: Array.from({ length: colours }, (_, at): Pen => [at * 10, 0, 0]),
    tiles: pens.map((pen) => ({ indices: new Uint8Array(8).fill(pen) })),
    instanceOf: pens.map((_, at) => at),
    unique: pens.map((_, at) => at),
    transparentPen: null,
    collisions: [],
    resizeSearch: null
  }
}

/** The input of a map export — Plus, so any colour is a hardware one. */
function mapOf(pens: number[]): Partial<ExportTilesetTiledInput> {
  const tileset = tilesetOfPens(pens)
  return {
    tileset,
    hardware: 'plus',
    map: mapTileset(tileset, { budget: 256 })
  }
}

async function entryOf(
  name: string,
  overrides: Partial<ExportTilesetTiledInput>
) {
  const { blob } = await exported(overrides)
  return readEntry(blob, name)
}

/** Twenty tiles, all distinct — past one row of the atlas. */
const TWENTY = Array.from({ length: 20 }, (_, at) => at)

describe('exportTilesetTiled, map layout', () => {
  it('packs the map next to its tileset', async () => {
    const { blob } = await exported(mapOf([0, 1, 0]))
    const zip = await JSZip.loadAsync(blob as Blob)

    expect(Object.keys(zip.files).sort()).toEqual([
      'map.tmx',
      'tileset.png',
      'tileset.tsx'
    ])
  })

  it('counts only the tiles the map keeps', async () => {
    expect(await entryOf('tileset.tsx', mapOf([0, 1, 0]))).toContain(
      'tilecount="2"'
    )
  })

  it('lays the atlas on as many columns as it has tiles, below 16', async () => {
    expect(await entryOf('tileset.tsx', mapOf([0, 1, 0]))).toContain(
      'columns="2"'
    )
  })

  // M-Q12: 16 columns, whatever the width of the map.
  it('wraps the atlas at 16 columns', async () => {
    expect(await entryOf('tileset.tsx', mapOf(TWENTY))).toContain(
      'columns="16"'
    )
  })

  it('draws the atlas on as many rows as the tiles need', async () => {
    const { canvasFactory } = await exported(mapOf(TWENTY))

    // 16 tiles of 8 stretched pixels across, 2 rows of 2 pixels down.
    expect(canvasFactory.createCanvas).toHaveBeenCalledWith(128, 4)
  })

  it('points the map at the tileset next to it', async () => {
    expect(await entryOf('map.tmx', mapOf([0, 1, 0]))).toContain(
      '<tileset firstgid="1" source="tileset.tsx"/>'
    )
  })

  it('sizes the map in cells of the source grid', async () => {
    expect(await entryOf('map.tmx', mapOf([0, 1, 0]))).toContain(
      'width="3" height="1" tilewidth="8" tileheight="2"'
    )
  })

  it('numbers each cell by its tile, from the first GID', async () => {
    expect(await entryOf('map.tmx', mapOf([0, 1, 0]))).toContain(
      '<data encoding="csv">\n1,2,1\n</data>'
    )
  })
})
