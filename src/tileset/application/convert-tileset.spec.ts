import type { ConvertTilesetInput } from './convert-tileset'
import { convertTileset } from './convert-tileset'

/** Build an RGBA sheet of `columns` × 1 solid-colour tiles, `size` px each. */
function sheetOfSolidTiles(
  size: number,
  colours: [number, number, number][]
): ConvertTilesetInput['sheet'] {
  const width = size * colours.length
  const data = new Uint8ClampedArray(width * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colours[Math.floor(x / size)]
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { width, height: size, data }
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
