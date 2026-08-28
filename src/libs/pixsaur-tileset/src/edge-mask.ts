/**
 * The partition of Q17 · Q27: contours belong to the anti-aliasing pass, flat
 * areas belong to the ditherer, and no pixel ever goes through both. Dithering
 * a contour destroys the line; anti-aliasing a flat area invents a gradient.
 */

export interface EdgeMaskOptions {
  /** A value that stands for no colour at all — the hole marker of Q16. */
  ignore?: number
}

/**
 * Marks every pixel that sits against a different colour. Works on whatever
 * per-pixel value the caller carries — base-palette index or pen — as long as
 * equal values mean the same colour.
 *
 * Holes take no side: a hole is never marked, and a hole neighbour never turns
 * its neighbour into a contour. Blending a sprite's silhouette with the hole
 * would tint it with a background it will not be laid on — the halo the plan
 * calls the most visible mistake of the lot (Q13).
 */
export function tileEdgeMask(
  tile: ArrayLike<number>,
  width: number,
  height: number,
  { ignore }: EdgeMaskOptions = {}
): Uint8Array {
  const mask = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * width + x
      if (tile[at] === ignore) continue
      mask[at] = differsFromNeighbour(tile, width, height, x, y, ignore) ? 1 : 0
    }
  }

  return mask
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1]
]

function differsFromNeighbour(
  tile: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
  ignore: number | undefined
): boolean {
  return NEIGHBOURS.some(([dx, dy]) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false
    const neighbour = tile[ny * width + nx]
    return neighbour !== ignore && neighbour !== tile[y * width + x]
  })
}
