/**
 * Which cell of a map the pointer is over, from where the page laid the image
 * out. The image is drawn edge to edge — no gutter — so a cell is one equal
 * share of each axis, whatever size the page gives the image.
 */

interface LaidOut {
  left: number
  top: number
  width: number
  height: number
}

interface MapGrid {
  columns: number
  rows: number
}

export function cellAt(
  point: { x: number; y: number },
  image: LaidOut,
  grid: MapGrid
): number | null {
  // An image the page has not laid out yet has no cell to point at.
  if (!(image.width > 0 && image.height > 0)) return null

  const column = Math.floor(
    ((point.x - image.left) / image.width) * grid.columns
  )
  const row = Math.floor(((point.y - image.top) / image.height) * grid.rows)
  if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) {
    return null
  }

  return row * grid.columns + column
}
