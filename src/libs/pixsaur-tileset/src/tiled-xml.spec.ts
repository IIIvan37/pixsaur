import {
  type TiledMapDocument,
  type TiledTilesetDocument,
  writeTiledMap,
  writeTiledTileset
} from './tiled-xml'

function map(overrides: Partial<TiledMapDocument> = {}): TiledMapDocument {
  return {
    width: 3,
    height: 2,
    tileWidth: 16,
    tileHeight: 8,
    tileset: { firstGid: 1, source: 'tileset.tsx' },
    layer: { name: 'map', gids: [1, 2, 3, 4, 5, 6] },
    ...overrides
  }
}

describe('writeTiledMap', () => {
  it('opens with an XML declaration', () => {
    expect(writeTiledMap(map())).toMatch(
      /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/
    )
  })

  it('declares a finite orthogonal map drawn right-down', () => {
    expect(writeTiledMap(map())).toContain(
      '<map version="1.10" orientation="orthogonal" renderorder="right-down" width="3" height="2" tilewidth="16" tileheight="8" infinite="0" nextlayerid="2" nextobjectid="1">'
    )
  })

  it('refers to its tileset as an external file', () => {
    expect(writeTiledMap(map())).toContain(
      '<tileset firstgid="1" source="tileset.tsx"/>'
    )
  })

  it('sizes its one layer like the map', () => {
    expect(writeTiledMap(map())).toContain(
      '<layer id="1" name="map" width="3" height="2">'
    )
  })

  it('writes the cells as CSV, one row of the map per line', () => {
    expect(writeTiledMap(map())).toContain(
      '<data encoding="csv">\n1,2,3,\n4,5,6\n</data>'
    )
  })
})

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
