/**
 * Floyd-Steinberg diffusion, one tile at a time.
 *
 * The accumulator is allocated per call and never crosses a tile boundary
 * (Q12): a residual carried from the tile on the left would make two copies of
 * the same tile come out different, and deduplication — which the whole edit
 * link of Q11 rests on — would stop matching them.
 *
 * The contours are left out of the partition of Q17 · Q27 in both directions:
 * a masked pixel takes its plain nearest pen, and the error it would have
 * pushed onto its neighbours is dropped rather than spread over an area the
 * anti-aliasing owns.
 */

export interface DiffusionColours {
  /** The colour a base-palette index asks for. */
  wanted: (index: number) => readonly number[]
  /** The pen standing closest to an arbitrary colour. */
  nearest: (colour: readonly number[]) => number
  /** The colour a pen actually paints — what the residual is measured from. */
  painted: (pen: number) => readonly number[]
}

export interface DiffuseOptions {
  /** Pixels the anti-aliasing owns; they neither take nor give any error. */
  mask?: ArrayLike<number>
  /** A value that stands for no colour at all — the hole marker of Q16. */
  ignore?: number
  /** Pen a hole is written as. Defaults to 0, the pen sprite routines test. */
  holePen?: number
}

/** Right, down-left, down, down-right — the Floyd-Steinberg neighbourhood. */
const SPREAD: readonly (readonly [number, number, number])[] = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16]
]

export function diffuseTile(
  tile: ArrayLike<number>,
  width: number,
  height: number,
  colours: DiffusionColours,
  { mask, ignore, holePen = 0 }: DiffuseOptions = {}
): Uint8Array {
  const pens = new Uint8Array(width * height)
  const carried: number[][] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * width + x
      if (tile[at] === ignore) {
        pens[at] = holePen
        continue
      }

      const wanted = colours.wanted(tile[at])
      if (mask?.[at]) {
        pens[at] = colours.nearest(wanted)
        continue
      }

      const debt = carried[at]
      const asked = debt
        ? wanted.map((c, channel) => c + debt[channel])
        : wanted
      const pen = colours.nearest(asked)
      pens[at] = pen
      const painted = colours.painted(pen)
      spread(
        carried,
        asked.map((c, channel) => c - painted[channel]),
        { width, height, x, y },
        (to) => tile[to] !== ignore && !mask?.[to]
      )
    }
  }

  return pens
}

function spread(
  carried: number[][],
  residual: readonly number[],
  from: { width: number; height: number; x: number; y: number },
  takes: (at: number) => boolean
): void {
  SPREAD.forEach(([dx, dy, share]) => {
    const nx = from.x + dx
    const ny = from.y + dy
    if (nx < 0 || ny < 0 || nx >= from.width || ny >= from.height) return
    const to = ny * from.width + nx
    if (!takes(to)) return
    carried[to] ??= residual.map(() => 0)
    const debt = carried[to]
    residual.forEach((error, channel) => {
      debt[channel] += error * share
    })
  })
}
