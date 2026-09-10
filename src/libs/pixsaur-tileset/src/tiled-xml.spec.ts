import { type TiledTilesetDocument, writeTiledTileset } from './tiled-xml'

function tileset(
  overrides: Partial<TiledTilesetDocument> = {}
): TiledTilesetDocument {
  return {
    name: 'tileset',
    tileWidth: 16,
    tileHeight: 8,
    tileCount: 6,
    columns: 3,
    image: { source: 'tileset.png', width: 48, height: 16 },
    ...overrides
  }
}

describe('writeTiledTileset', () => {
  it('opens with an XML declaration', () => {
    expect(writeTiledTileset(tileset())).toMatch(
      /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/
    )
  })

  it('declares the tile grid on the root element', () => {
    expect(writeTiledTileset(tileset())).toContain(
      '<tileset version="1.10" name="tileset" tilewidth="16" tileheight="8" tilecount="6" columns="3">'
    )
  })

  it('points at the image with its size', () => {
    expect(writeTiledTileset(tileset())).toContain(
      '<image source="tileset.png" width="48" height="16"/>'
    )
  })

  it('writes no properties block when there is none', () => {
    expect(writeTiledTileset(tileset())).not.toContain('<properties>')
  })

  it('types an integer property', () => {
    expect(
      writeTiledTileset(
        tileset({ properties: [{ name: 'cpcMode', type: 'int', value: 0 }] })
      )
    ).toContain('<property name="cpcMode" type="int" value="0"/>')
  })

  // Tiled reads a property with no type as a string.
  it('leaves the type out of a string property', () => {
    expect(
      writeTiledTileset(
        tileset({
          properties: [{ name: 'hardware', type: 'string', value: 'plus' }]
        })
      )
    ).toContain('<property name="hardware" value="plus"/>')
  })

  // Tiled writes the properties before the image; its own reader accepts
  // both orders, other readers may not.
  it('writes the properties before the image', () => {
    const xml = writeTiledTileset(
      tileset({ properties: [{ name: 'cpcMode', type: 'int', value: 0 }] })
    )

    expect(xml.indexOf('<properties>')).toBeLessThan(xml.indexOf('<image'))
  })

  it('escapes what XML reserves in an attribute', () => {
    expect(writeTiledTileset(tileset({ name: `a&b<"c'>` }))).toContain(
      'name="a&amp;b&lt;&quot;c&apos;&gt;"'
    )
  })
})
