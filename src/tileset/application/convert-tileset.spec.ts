import type { ConvertTilesetInput } from './convert-tileset'
import { convertTileset } from './convert-tileset'

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
      source: { tileWidth: 8, tileHeight: 8, margin: 1, spacing: 2 }
    })

    expect(result.ok && result.tileset.palette).toEqual([
      [255, 0, 0],
      [0, 0, 255]
    ])
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

  it('rejects a sheet needing more pens than the mode offers', () => {
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

    expect(result.ok === false && result.error).toBe('palette-overflow')
  })
})
