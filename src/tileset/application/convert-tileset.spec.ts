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
})
