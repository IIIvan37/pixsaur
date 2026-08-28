/**
 * Lays the converted tiles back out on the grid the source sheet used (Q10).
 *
 * Margins and spacings are restored so the output can be laid over the source
 * for a visual diff — the main feedback the user has to judge a conversion.
 * They are restored at the TILE's new scale: kept in source pixels they would
 * weigh a quarter of a sheet whose tiles went from 16 to 8.
 */

import type { SheetGrid, TileGrid } from './slice-sheet'

/** The blanks of a sheet, in destination pixels, before any mode stretch. */
export interface SheetGutters {
  /** Blank before the first tile — the source margin plus its grid offset. */
  leadingX: number
  leadingY: number
  /** Blank after the last tile — the source margin alone. */
  trailingX: number
  trailingY: number
  /** Gap between two neighbouring tiles. */
  gapX: number
  gapY: number
}

/**
 * The source blanks, brought to the scale the tile now has. Rounded up from a
 * half pixel, so a one-pixel gap between two tiles survives a halving instead
 * of closing — a closed gap reads as a grid error, not as a rounding.
 */
export function scaleSheetGutters(
  source: SheetGrid,
  target: TileGrid
): SheetGutters {
  const margin = source.margin ?? 0
  const spacing = source.spacing ?? 0
  const x = target.tileWidth / source.tileWidth
  const y = target.tileHeight / source.tileHeight

  return {
    leadingX: Math.round((margin + (source.offsetX ?? 0)) * x),
    leadingY: Math.round((margin + (source.offsetY ?? 0)) * y),
    trailingX: Math.round(margin * x),
    trailingY: Math.round(margin * y),
    gapX: Math.round(spacing * x),
    gapY: Math.round(spacing * y)
  }
}

export interface AssembleSheetOptions {
  columns: number
  rows: number
  /** Tile size in destination pixels, before the mode stretch. */
  tile: TileGrid
  gutters: SheetGutters
  /** How wide and tall one destination pixel is drawn (Q9). */
  stretch: { x: number; y: number }
  /** The pen the blanks take — the hole of Q16, or the background. */
  fill: number
}

export interface AssembledSheet {
  width: number
  height: number
  /** One palette index per pixel, `width * height` long. */
  indices: Uint8Array
}

/** Total extent of one axis, gutters and stretch included. */
function extent(
  count: number,
  size: number,
  leading: number,
  trailing: number,
  gap: number,
  stretch: number
): number {
  return (leading + count * size + (count - 1) * gap + trailing) * stretch
}

export function assembleSheet(
  tiles: readonly Uint8Array[],
  options: AssembleSheetOptions
): AssembledSheet {
  const { columns, rows, tile, gutters, stretch, fill } = options
  const width = extent(
    columns,
    tile.tileWidth,
    gutters.leadingX,
    gutters.trailingX,
    gutters.gapX,
    stretch.x
  )
  const height = extent(
    rows,
    tile.tileHeight,
    gutters.leadingY,
    gutters.trailingY,
    gutters.gapY,
    stretch.y
  )

  const indices = new Uint8Array(width * height).fill(fill)

  tiles.forEach((pens, at) => {
    const column = at % columns
    const row = Math.floor(at / columns)
    const originX =
      (gutters.leadingX + column * (tile.tileWidth + gutters.gapX)) * stretch.x
    const originY =
      (gutters.leadingY + row * (tile.tileHeight + gutters.gapY)) * stretch.y

    for (let y = 0; y < tile.tileHeight; y++) {
      for (let x = 0; x < tile.tileWidth; x++) {
        const pen = pens[y * tile.tileWidth + x]
        for (let dy = 0; dy < stretch.y; dy++) {
          const start =
            (originY + y * stretch.y + dy) * width + originX + x * stretch.x
          indices.fill(pen, start, start + stretch.x)
        }
      }
    }
  })

  return { width, height, indices }
}
