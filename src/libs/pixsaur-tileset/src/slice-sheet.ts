/**
 * Cuts an RGBA sheet into a grid of equally sized tiles.
 *
 * Margin, spacing and offset arrive in T3 — see
 * `docs/features/PLAN-tileset-workshop.md`.
 */

export interface Sheet {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface TileGrid {
  tileWidth: number
  tileHeight: number
}

/** One source tile, RGBA, `tileWidth * tileHeight * 4` bytes. */
export interface SourceTile {
  data: Uint8ClampedArray
}

export interface SlicedSheet {
  columns: number
  rows: number
  tiles: SourceTile[]
}

/** Slice `sheet` into tiles, or `null` when the grid does not divide it. */
export function sliceSheet(sheet: Sheet, grid: TileGrid): SlicedSheet | null {
  const { tileWidth, tileHeight } = grid
  if (tileWidth <= 0 || tileHeight <= 0) return null
  if (sheet.width % tileWidth !== 0 || sheet.height % tileHeight !== 0) {
    return null
  }

  const columns = sheet.width / tileWidth
  const rows = sheet.height / tileHeight
  const tiles: SourceTile[] = []

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const data = new Uint8ClampedArray(tileWidth * tileHeight * 4)
      for (let y = 0; y < tileHeight; y++) {
        const sourceStart =
          ((row * tileHeight + y) * sheet.width + column * tileWidth) * 4
        data.set(
          sheet.data.subarray(sourceStart, sourceStart + tileWidth * 4),
          y * tileWidth * 4
        )
      }
      tiles.push({ data })
    }
  }

  return { columns, rows, tiles }
}
