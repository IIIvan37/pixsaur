/**
 * The dithering half of the partition (Q17 · Q27): flat areas only, contours
 * left to the anti-aliasing pass.
 *
 * The phase is read from TILE coordinates, and the function is given no sheet
 * position at all — that is the guarantee of Q11. Two tiles the sheet repeats
 * must dither identically, or deduplication would stop linking them and the
 * edit propagation would silently break.
 */

export interface PenMix {
  /** Pen nearest the wanted colour, for each base-palette index. */
  primary: ArrayLike<number>
  /** Second nearest pen — the other half of the mixture. */
  secondary: ArrayLike<number>
  /** How far the wanted colour sits between the two, 0 (primary) to 1. */
  mix: ArrayLike<number>
}

export interface OrderedDitherOptions {
  /** Side of the Bayer matrix: 2, 4 or 8. Defaults to 4. */
  size?: number
  /** Pixels the anti-aliasing owns; the ditherer does not touch them. */
  mask?: ArrayLike<number>
  /** A value that stands for no colour at all — the hole marker of Q16. */
  ignore?: number
  /** Pen a hole is written as. Defaults to 0, the pen sprite routines test. */
  holePen?: number
}

const DEFAULT_SIZE = 4

export function orderedDitherTile(
  tile: ArrayLike<number>,
  width: number,
  height: number,
  pens: PenMix,
  { size, mask, ignore, holePen = 0 }: OrderedDitherOptions = {}
): Uint8Array {
  const thresholds = bayerThresholds(size ?? DEFAULT_SIZE)
  const side = Math.round(Math.sqrt(thresholds.length))
  const dithered = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * width + x
      if (tile[at] === ignore) {
        dithered[at] = holePen
        continue
      }
      const wanted = tile[at]
      const threshold = thresholds[(y % side) * side + (x % side)]
      dithered[at] =
        mask?.[at] || pens.mix[wanted] <= threshold
          ? pens.primary[wanted]
          : pens.secondary[wanted]
    }
  }

  return dithered
}

const cached = new Map<number, Float64Array>()

/** Rank each quadrant takes when the matrix doubles — the Bayer recursion. */
const QUADRANTS = [0, 2, 3, 1]

/**
 * A Bayer matrix, normalized into open (0, 1) and flattened row-major. Built by
 * recursive doubling rather than copied from a table: the same three sizes the
 * image workshop offers, without a second transcription of them to keep in
 * step.
 */
export function bayerThresholds(size: number): Float64Array {
  const known = cached.get(size)
  if (known) return known

  let matrix = [0]
  let side = 1
  while (side < size) {
    const grown = new Array<number>(side * side * 4)
    const wider = side * 2
    for (let y = 0; y < wider; y++) {
      for (let x = 0; x < wider; x++) {
        const block = Math.floor(y / side) * 2 + Math.floor(x / side)
        grown[y * wider + x] =
          4 * matrix[(y % side) * side + (x % side)] + QUADRANTS[block]
      }
    }
    matrix = grown
    side = wider
  }

  const thresholds = Float64Array.from(
    matrix,
    (rank) => (rank + 0.5) / matrix.length
  )
  cached.set(size, thresholds)
  return thresholds
}
