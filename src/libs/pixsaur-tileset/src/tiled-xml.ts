/**
 * Writes the XML documents of the Tiled map editor.
 *
 * Tiled is the pivot format of the map export (M-Q2): the user retouches the
 * map there, then their own toolchain takes it to the target machine. The
 * writer knows no machine — what a target needs to read back arrives as
 * properties. See `docs/features/PLAN-tileset-map.md`.
 */

/** Tiled stores a property without a type as a string. */
export interface TiledProperty {
  name: string
  type: 'string' | 'int'
  value: string | number
}

export interface TiledImage {
  /** Path of the image, relative to the document that names it. */
  source: string
  width: number
  height: number
}

/** A tileset cut from one image on a regular grid, with no gutter. */
export interface TiledTilesetDocument {
  name: string
  tileWidth: number
  tileHeight: number
  tileCount: number
  columns: number
  image: TiledImage
  properties?: readonly TiledProperty[]
}

/** An orthogonal map of one tile layer over one external tileset. */
export interface TiledMapDocument {
  /** Size of the map, in cells. */
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  tileset: { firstGid: number; source: string }
  /** One GID per cell, in reading order. GID 0 is a cell with no tile. */
  layer: { name: string; gids: readonly number[] }
}

/** The format version the documents declare. */
const TILED_FORMAT = '1.10'

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}

function escapeAttribute(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (reserved) => ESCAPES[reserved])
}

function attributes(pairs: ReadonlyArray<[string, string | number]>): string {
  return pairs
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('')
}

function propertyLines(
  properties: readonly TiledProperty[] | undefined,
  indent: string
): string[] {
  if (!properties?.length) return []

  return [
    `${indent}<properties>`,
    ...properties.map(({ name, type, value }) => {
      const typed: Array<[string, string]> =
        type === 'string' ? [] : [['type', type]]
      return `${indent} <property${attributes([
        ['name', name],
        ...typed,
        ['value', value]
      ])}/>`
    }),
    `${indent}</properties>`
  ]
}

/** The TSX document of an external tileset. */
export function writeTiledTileset(tileset: TiledTilesetDocument): string {
  const { image } = tileset
  const lines = [
    `<tileset${attributes([
      ['version', TILED_FORMAT],
      ['name', tileset.name],
      ['tilewidth', tileset.tileWidth],
      ['tileheight', tileset.tileHeight],
      ['tilecount', tileset.tileCount],
      ['columns', tileset.columns]
    ])}>`,
    // Tiled writes the properties before the image. Its own reader takes
    // either order; other readers may not.
    ...propertyLines(tileset.properties, ' '),
    ` <image${attributes([
      ['source', image.source],
      ['width', image.width],
      ['height', image.height]
    ])}/>`,
    '</tileset>'
  ]

  return `${XML_DECLARATION}${lines.join('\n')}\n`
}

/** The TMX document of a map whose tileset lives in its own file. */
export function writeTiledMap(map: TiledMapDocument): string {
  const { width, height, layer } = map
  // Tiled writes the CSV one row of the map per line, every row but the last
  // ending on a comma.
  const rows = Array.from({ length: height }, (_, row) =>
    layer.gids.slice(row * width, (row + 1) * width).join(',')
  )

  const lines = [
    `<map${attributes([
      ['version', TILED_FORMAT],
      ['orientation', 'orthogonal'],
      ['renderorder', 'right-down'],
      ['width', width],
      ['height', height],
      ['tilewidth', map.tileWidth],
      ['tileheight', map.tileHeight],
      ['infinite', 0],
      ['nextlayerid', 2],
      ['nextobjectid', 1]
    ])}>`,
    ` <tileset${attributes([
      ['firstgid', map.tileset.firstGid],
      ['source', map.tileset.source]
    ])}/>`,
    ` <layer${attributes([
      ['id', 1],
      ['name', layer.name],
      ['width', width],
      ['height', height]
    ])}>`,
    '  <data encoding="csv">',
    rows.join(',\n'),
    '</data>',
    ' </layer>',
    '</map>'
  ]

  return `${XML_DECLARATION}${lines.join('\n')}\n`
}
