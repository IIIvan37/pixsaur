import { cpcPalette, vectorToHex } from '@/domain/cpc'
import type { ConvertTilesetInput, Pen } from './convert-tileset'
import { convertTileset } from './convert-tileset'

/** Whether the PNG carries a chunk of that name. */
const hasChunk = (png: Uint8Array, name: string) =>
  [...png].some((_, at) =>
    name.split('').every((letter, o) => png[at + o] === letter.charCodeAt(0))
  )

/** The pens a palette holds, order-free — the strategy owns the order now. */
const penSet = (palette: Pen[]) => palette.map(vectorToHex).sort()

/** Painted over every pixel a tile does not cover, so gutters stand out. */
const GUTTER: [number, number, number] = [0, 255, 0]

interface Blanks {
  margin?: number
  spacing?: number
}

/** Build an RGBA sheet of `columns` × 1 solid-colour tiles, `size` px each. */
function sheetOfSolidTiles(
  size: number,
  colours: [number, number, number][],
  blanks: Blanks = {}
): ConvertTilesetInput['sheet'] {
  const margin = blanks.margin ?? 0
  const spacing = blanks.spacing ?? 0
  const width =
    2 * margin + colours.length * size + (colours.length - 1) * spacing
  const height = 2 * margin + size
  const data = new Uint8ClampedArray(width * height * 4)

  const paint = (x: number, y: number, [r, g, b]: [number, number, number]) => {
    const i = (y * width + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) paint(x, y, GUTTER)
  }
  colours.forEach((colour, tile) => {
    const originX = margin + tile * (size + spacing)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) paint(originX + x, margin + y, colour)
    }
  })

  return { width, height, data }
}

/** A single 8 × 8 tile whose column `x` is uniformly painted `columns[x]`. */
function sheetOfColumns(
  columns: [number, number, number][]
): ConvertTilesetInput['sheet'] {
  const width = columns.length
  const data = new Uint8ClampedArray(width * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      ;[data[at], data[at + 1], data[at + 2]] = columns[x]
      data[at + 3] = 255
    }
  }
  return { width, height: 8, data }
}

/** One 8 x 8 tile, white but fully transparent — alpha must decide, not RGB. */
function transparentSheet(): ConvertTilesetInput['sheet'] {
  const data = new Uint8ClampedArray(8 * 8 * 4).fill(255)
  for (let pixel = 0; pixel < 8 * 8; pixel++) data[pixel * 4 + 3] = 0
  return { width: 8, height: 8, data }
}

/**
 * Three 8 x 8 tiles: a fully transparent hole, an OPAQUE black tile, a red one.
 * The hole flattens onto the same black — so only a dedicated pen can tell the
 * first two apart.
 */
function sheetWithHole(): ConvertTilesetInput['sheet'] {
  const width = 24
  const data = new Uint8ClampedArray(width * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 8; x < width; x++) {
      const at = (y * width + x) * 4
      if (x >= 16) data[at] = 255
      data[at + 3] = 255
    }
  }
  return { width, height: 8, data }
}

const RED: [number, number, number] = [255, 0, 0]
const BLUE: [number, number, number] = [0, 0, 255]

const input: ConvertTilesetInput = {
  sheet: sheetOfSolidTiles(8, [
    [255, 0, 0],
    [0, 0, 255]
  ]),
  source: { tileWidth: 8, tileHeight: 8 },
  target: { tileWidth: 4, tileHeight: 8 },
  mode: 0,
  hardware: 'classic'
}

const BLACK: [number, number, number] = [0, 0, 0]
const WHITE: [number, number, number] = [255, 255, 255]
const GREY: [number, number, number] = [128, 128, 128]

/** A tile the frozen palette cannot say: it sits halfway between two pens. */
const halfway: ConvertTilesetInput = {
  sheet: sheetOfSolidTiles(8, [BLACK, WHITE, GREY, GREY]),
  source: { tileWidth: 8, tileHeight: 8 },
  target: { tileWidth: 8, tileHeight: 8 },
  mode: 2,
  hardware: 'classic',
  transparency: 'flatten',
  palette: [BLACK, WHITE]
}

/** Pens the tile at `at` actually uses, deduplicated. */
const pensUsed = (result: ReturnType<typeof convertTileset>, at: number) =>
  result.ok ? [...new Set(result.tileset.tiles[at].indices)].sort() : []

/** One 8 x 8 tile split by a 45 degree edge — a staircase, not a straight line. */
function sheetOfDiagonal(): ConvertTilesetInput['sheet'] {
  const data = new Uint8ClampedArray(8 * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const at = (y * 8 + x) * 4
      if (x < y) data[at] = 255
      else data[at + 2] = 255
      data[at + 3] = 255
    }
  }
  return { width: 8, height: 8, data }
}

const MIDDLE: [number, number, number] = [128, 0, 128]

const staircase: ConvertTilesetInput = {
  sheet: sheetOfDiagonal(),
  source: { tileWidth: 8, tileHeight: 8 },
  target: { tileWidth: 8, tileHeight: 8 },
  mode: 0,
  hardware: 'classic',
  transparency: 'flatten',
  palette: [RED, BLUE, MIDDLE]
}

describe('convertTileset', () => {
  it('produces one destination tile per source tile', () => {
    const result = convertTileset(input)

    expect(result.ok && result.tileset.tiles.length).toBe(2)
  })

  it('sizes each destination tile to the target', () => {
    const result = convertTileset(input)

    expect(result.ok && result.tileset.tiles[0].indices.length).toBe(4 * 8)
  })

  it('maps a solid red tile to a CPC red pen', () => {
    const result = convertTileset(input)

    expect(
      result.ok && result.tileset.palette[result.tileset.tiles[0].indices[0]]
    ).toEqual([255, 0, 0])
  })

  it('renders the tileset as an indexed PNG', () => {
    const result = convertTileset(input)

    expect(result.ok && Array.from(result.png.subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10
    ])
  })

  it('pre-stretches mode 0 pixels so the PNG opens undistorted', () => {
    const result = convertTileset(input)
    // 2 tiles x 4 CPC px, doubled horizontally (mode 0 scaleX = 2).
    const width = result.ok && new DataView(result.png.buffer).getUint32(16)

    expect(width).toBe(16)
  })

  it('skips the margin and spacing declared on the source grid', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfSolidTiles(
        8,
        [
          [255, 0, 0],
          [0, 0, 255]
        ],
        { margin: 1, spacing: 2 }
      ),
      source: { tileWidth: 8, tileHeight: 8, margin: 1, spacing: 2 },
      transparency: 'flatten'
    })

    expect(result.ok && penSet(result.tileset.palette)).toEqual([
      '0000ff',
      'ff0000'
    ])
  })

  it('gives the PNG back the gutters the source sheet declared', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfSolidTiles(
        8,
        [
          [255, 0, 0],
          [0, 0, 255]
        ],
        { margin: 1, spacing: 2 }
      ),
      source: { tileWidth: 8, tileHeight: 8, margin: 1, spacing: 2 },
      transparency: 'flatten'
    })
    // Halved with the tile: 1 + 4 + 1 + 4 + 1 CPC px, doubled by mode 0.
    const width = result.ok && new DataView(result.png.buffer).getUint32(16)

    expect(width).toBe(22)
  })

  it('links a repeated tile back to its first occurrence', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfSolidTiles(8, [
        [255, 0, 0],
        [0, 0, 255],
        [255, 0, 0]
      ])
    })

    expect(result.ok && result.tileset.instanceOf).toEqual([0, 1, 0])
  })

  it('quantizes a sheet richer than the mode instead of rejecting it', () => {
    const tooManyColours = sheetOfSolidTiles(8, [
      [255, 0, 0],
      [0, 0, 255],
      [0, 255, 0]
    ])

    const result = convertTileset({
      ...input,
      sheet: tooManyColours,
      mode: 2
    })

    expect(result.ok && result.tileset.palette.length).toBe(2)
  })

  it('keeps free the pens the sprites asked to have reserved', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfSolidTiles(8, cpcPalette as [number, number, number][]),
      reservedPens: 4
    })

    expect(result.ok && result.tileset.palette.length).toBe(12)
  })

  it('refuses a reservation that leaves the tileset no pen at all', () => {
    const result = convertTileset({ ...input, mode: 1, reservedPens: 4 })

    expect(result.ok === false && result.error).toBe('no-pens-left')
  })

  it('flattens a transparent pixel onto the background in mode 1', () => {
    const result = convertTileset({
      ...input,
      sheet: transparentSheet(),
      mode: 1
    })

    expect(result.ok && penSet(result.tileset.palette)).toEqual(['000000'])
  })

  it('spends a pen on transparency in mode 0', () => {
    const result = convertTileset({ ...input, sheet: sheetWithHole() })

    expect(result.ok && result.tileset.transparentPen).toBe(0)
  })

  it('tells a hole apart from an opaque tile of the same colour', () => {
    const result = convertTileset({ ...input, sheet: sheetWithHole() })

    expect(result.ok && result.tileset.instanceOf).toEqual([0, 1, 2])
  })

  it('never sends an opaque pixel to the transparency pen', () => {
    const result = convertTileset({ ...input, sheet: sheetWithHole() })

    expect(result.ok && result.tileset.tiles[1].indices[0]).not.toBe(0)
  })

  it('marks the transparency pen transparent in the PNG', () => {
    const result = convertTileset({ ...input, sheet: sheetWithHole() })

    expect(result.ok && hasChunk(result.png, 'tRNS')).toBe(true)
  })

  it('blames no tile when every colour got a pen of its own', () => {
    const result = convertTileset(input)

    expect(result.ok && result.tileset.collisions.map((c) => c.error)).toEqual([
      0, 0
    ])
  })

  it('blames the tiles a short palette hurt', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfSolidTiles(8, [RED, BLUE, [0, 255, 0]]),
      mode: 2
    })

    expect(result.ok && result.tileset.collisions[0].error).toBeGreaterThan(0)
  })

  it('ranks only the distinct tiles, since editing one reaches them all', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfSolidTiles(8, [RED, BLUE, RED])
    })

    expect(result.ok && result.tileset.collisions.length).toBe(2)
  })

  it('uses the frozen palette it was handed instead of choosing one', () => {
    const result = convertTileset({
      ...input,
      palette: [
        [0, 0, 0],
        [255, 255, 255]
      ]
    })

    expect(result.ok && penSet(result.tileset.palette)).toEqual([
      '000000',
      'ffffff'
    ])
  })

  it('maps every colour onto the frozen palette', () => {
    const result = convertTileset({
      ...input,
      palette: [
        [0, 0, 0],
        [255, 255, 255]
      ]
    })

    expect(result.ok && result.tileset.tiles[0].indices[0]).toBe(1)
  })

  it('keeps a locked pen even when the sheet never uses it', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfSolidTiles(8, [RED, BLUE, [0, 255, 0]]),
      mode: 2,
      lockedPens: [[255, 255, 255]]
    })

    expect(result.ok && penSet(result.tileset.palette)).toContain('ffffff')
  })

  it('keeps a column nearest-neighbour would step over', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfColumns([RED, RED, RED, RED, RED, RED, RED, BLUE])
    })

    expect(
      result.ok && result.tileset.palette[result.tileset.tiles[0].indices[3]]
    ).toEqual(BLUE)
  })

  it('keeps nearest-neighbour available to compare against', () => {
    const result = convertTileset({
      ...input,
      sheet: sheetOfColumns([RED, RED, RED, RED, RED, RED, RED, BLUE]),
      resize: 'nearest',
      transparency: 'flatten'
    })

    expect(result.ok && result.tileset.palette).toEqual([RED])
  })

  it('leaves a tile flat when no dithering was asked for', () => {
    expect(pensUsed(convertTileset(halfway), 2)).toHaveLength(1)
  })

  it('mixes two pens to say a colour the palette has not got', () => {
    expect(
      pensUsed(convertTileset({ ...halfway, dither: 'ordered' }), 2)
    ).toHaveLength(2)
  })

  it('mixes two pens by diffusion as well', () => {
    expect(
      pensUsed(convertTileset({ ...halfway, dither: 'diffusion' }), 2)
    ).toHaveLength(2)
  })

  it('lets one tile refuse the dithering the sheet asked for', () => {
    const result = convertTileset({
      ...halfway,
      dither: 'ordered',
      ditherByTile: { 2: 'none' }
    })

    expect(pensUsed(result, 2)).toHaveLength(1)
  })

  it('dithers two copies of a tile the same way, wherever they sit', () => {
    const result = convertTileset({ ...halfway, dither: 'ordered' })

    expect(result.ok && result.tileset.instanceOf[3]).toBe(2)
  })

  it('puts a middle pen on the steps of a staircase', () => {
    expect(pensUsed(convertTileset(staircase), 0)).toContain(2)
  })

  it('keeps a staircase raw when the anti-aliasing is turned off', () => {
    expect(
      pensUsed(convertTileset({ ...staircase, antiAlias: false }), 0)
    ).not.toContain(2)
  })

  it('never dithers a contour the anti-aliasing owns', () => {
    const dithered = convertTileset({ ...staircase, dither: 'ordered' })
    const plain = convertTileset(staircase)
    const pensOf = (r: ReturnType<typeof convertTileset>) =>
      r.ok ? [...r.tileset.tiles[0].indices] : []

    expect(pensOf(dithered)).toEqual(pensOf(plain))
  })
})
