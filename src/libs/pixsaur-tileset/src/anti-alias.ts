/**
 * The anti-aliasing half of the partition (Q17 · Q27). A dedicated pass run
 * AFTER quantization: it finds the pixels where a boundary turns — the steps of
 * a staircase — and puts on them the colour halfway between the two sides.
 *
 * Only the corners move. A straight boundary is a line the artist drew, and
 * softening it would blur the tile instead of smoothing it.
 */

export interface AntiAliasOptions {
  /** A value that stands for no colour at all — the hole marker of Q16. */
  ignore?: number
}

/**
 * Averages the two sides of every staircase step.
 *
 * Works on whatever per-pixel value the caller carries — here, base-palette
 * indices — and delegates the colour maths to `blend`, which receives the two
 * sides and returns the value standing between them. That keeps this module
 * free of any colour space, and lets the caller snap the average back onto the
 * hardware before it looks up a pen.
 */
export function antiAliasTile(
  tile: ArrayLike<number>,
  width: number,
  height: number,
  blend: (sides: readonly number[]) => number,
  { ignore }: AntiAliasOptions = {}
): Uint16Array {
  const smoothed = Uint16Array.from({ length: width * height }, (_, at) =>
    Number(tile[at])
  )

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * width + x
      if (tile[at] === ignore) continue
      const other = otherSide(tile, width, height, x, y, ignore)
      if (other !== null) smoothed[at] = blend([tile[at], other])
    }
  }

  return smoothed
}

/** Up, left, right, down — the order ties fall back on, so the pass is total. */
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1]
]

/**
 * The colour on the far side of the step, or `null` when the pixel is not a
 * step at all. A pixel is a step when the boundary TURNS on it: it differs from
 * a horizontal neighbour and from a vertical one. Holes take no side.
 */
function otherSide(
  tile: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
  ignore: number | undefined
): number | null {
  const own = tile[y * width + x]
  const differing: number[] = []
  let horizontal = false
  let vertical = false

  NEIGHBOURS.forEach(([dx, dy]) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
    const neighbour = tile[ny * width + nx]
    if (neighbour === ignore || neighbour === own) return
    differing.push(neighbour)
    if (dx !== 0) horizontal = true
    else vertical = true
  })

  if (!horizontal || !vertical) return null

  return differing.reduce((best, side) =>
    count(differing, side) > count(differing, best) ? side : best
  )
}

function count(values: readonly number[], value: number): number {
  return values.filter((each) => each === value).length
}
