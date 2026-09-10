/**
 * The four lookups every pixel of a tile is painted through.
 *
 * All of them answer the same question — which pen stands closest to a colour —
 * so they are computed in one pass over the colours the tiles can ask for,
 * rather than in three argmin loops written out separately. Nothing here knows
 * what a CPC is: the metric and the colours come from the caller, which is what
 * lets the tables sit next to the ditherers they serve.
 */

import type { DiffusionColours } from './diffuse-tile'
import type { PenMix } from './ordered-dither'
import type { PenSpace } from './pen-space'

/** A colour as the tables read it — channels, and no opinion on how many. */
export type PenColour = readonly number[]

export interface PenTablesInput {
  /** Every colour a pixel can ask for, indexed as the tiles index them. */
  wanted: readonly PenColour[]
  /** The pens the palette holds, in the order the strategy chose them. */
  chosen: readonly PenColour[]
  /** How far apart two colours look. */
  distance: (a: PenColour, b: PenColour) => number
  space: PenSpace
}

export interface PenTables {
  /**
   * How far each wanted colour had to travel to reach the pen it was given.
   * Same shape as the tiles' own indices, so the collision report of Q22 costs
   * one lookup per pixel.
   */
  error: Float64Array
  mix: PenMix
  diffusion: DiffusionColours
}

export function penTables({
  wanted,
  chosen,
  distance,
  space
}: PenTablesInput): PenTables {
  const primary = new Uint8Array(wanted.length)
  const secondary = new Uint8Array(wanted.length)
  const mix = new Float64Array(wanted.length)
  const error = new Float64Array(wanted.length)

  wanted.forEach((colour, index) => {
    const [first, second] = twoNearest(colour, chosen, distance)
    primary[index] = space.toPalette(first)
    secondary[index] = space.toPalette(second)
    mix[index] = ratioBetween(colour, chosen[first], chosen[second])
    error[index] = distance(colour, chosen[first])
  })

  return {
    error,
    mix: { primary, secondary, mix },
    diffusion: {
      wanted: (index) => wanted[index],
      painted: (pen) => chosen[space.toChosen(pen)],
      nearest: (colour) =>
        space.toPalette(twoNearest(colour, chosen, distance)[0])
    }
  }
}

/**
 * The two pens standing closest to a colour, nearest first. Ties keep the order
 * the strategy chose the pens in, so the same colour always lands on the same
 * pen — which is what keeps deduplication exact (Q30). With a single pen, both
 * halves of the mixture are that pen.
 */
function twoNearest(
  colour: PenColour,
  chosen: readonly PenColour[],
  distance: (a: PenColour, b: PenColour) => number
): [first: number, second: number] {
  let first = 0
  let second = 0
  let nearest = Number.POSITIVE_INFINITY
  let runnerUp = Number.POSITIVE_INFINITY

  chosen.forEach((pen, at) => {
    const apart = distance(colour, pen)
    if (apart < nearest) {
      second = first
      runnerUp = nearest
      first = at
      nearest = apart
      return
    }
    if (apart < runnerUp) {
      second = at
      runnerUp = apart
    }
  })

  return [first, second]
}

/**
 * How far `colour` sits from `from` towards `to`, clamped to the segment.
 *
 * A plain projection rather than the perceptual metric used to pick the pens:
 * this is the axis the mixture actually travels on screen.
 */
function ratioBetween(
  colour: PenColour,
  from: PenColour,
  to: PenColour
): number {
  const span = to.map((c, channel) => c - from[channel])
  const squared = span.reduce((sum, c) => sum + c * c, 0)
  if (squared === 0) return 0
  const along = span.reduce(
    (sum, c, channel) => sum + c * (colour[channel] - from[channel]),
    0
  )
  return Math.min(1, Math.max(0, along / squared))
}
