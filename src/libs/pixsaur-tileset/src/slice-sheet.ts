/**
 * Cuts an RGBA sheet into a grid of equally sized tiles.
 *
 * Half the tilesets in the wild are unreadable without margin and spacing
 * (Q5), so the grid carries them, plus an offset — the knob that decides
 * whether a grid lands on the tiles or one pixel off them (Q29).
 * See `docs/features/PLAN-tileset-workshop.md`.
 */

export interface Sheet {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** The size of one tile, in pixels of the space it belongs to. */
export interface TileGrid {
  tileWidth: number
  tileHeight: number
}

/** Where the tiles sit in a sheet: their size, plus the blanks around them. */
export interface SheetGrid extends TileGrid {
  /** Blank border on every side of the sheet, in source pixels. */
  margin?: number
  /** Gap between two neighbouring tiles. */
  spacing?: number
  /** Extra shift of the whole grid, past the margin. */
  offsetX?: number
  /** Extra shift of the whole grid, past the margin. */
  offsetY?: number
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

/** How many whole tiles fit along one axis, gaps included. */
function tilesAlong(
  extent: number,
  tileExtent: number,
  origin: number,
  margin: number,
  spacing: number
): number {
  const usable = extent - origin - margin
  if (usable < tileExtent) return 0
  return Math.floor((usable + spacing) / (tileExtent + spacing))
}

/**
 * Slice `sheet` into whole tiles, in reading order, or `null` when the grid
 * fits none. A grid that leaves a strip over on the right or the bottom keeps
 * the tiles it does cover — the sweep of Q29 compares grids that rarely divide
 * their sheet exactly.
 */
export function sliceSheet(sheet: Sheet, grid: SheetGrid): SlicedSheet | null {
  const { tileWidth, tileHeight } = grid
  const margin = grid.margin ?? 0
  const spacing = grid.spacing ?? 0
  const originX = margin + (grid.offsetX ?? 0)
  const originY = margin + (grid.offsetY ?? 0)
  if (tileWidth <= 0 || tileHeight <= 0) return null
  if (margin < 0 || spacing < 0 || originX < 0 || originY < 0) return null

  const columns = tilesAlong(sheet.width, tileWidth, originX, margin, spacing)
  const rows = tilesAlong(sheet.height, tileHeight, originY, margin, spacing)
  if (columns === 0 || rows === 0) return null

  const tiles: SourceTile[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const data = new Uint8ClampedArray(tileWidth * tileHeight * 4)
      const left = originX + column * (tileWidth + spacing)
      for (let y = 0; y < tileHeight; y++) {
        const sourceStart =
          ((originY + row * (tileHeight + spacing) + y) * sheet.width + left) *
          4
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
