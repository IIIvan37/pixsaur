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
