import {
  clearColorMapping,
  setColorMapping
} from '../../quant/color-mapping-cache'
import type { Vector } from '../../type'
import { mapAndDither } from '../map-and-dither'

/**
 * distinct-mapping pins each source colour to a palette index, overriding the
 * nearest-colour search. The mapping must arrive as an argument — see
 * docs/refactor/architecture-review-2026-08.md, candidate 2.
 */

const BLACK: Vector = [0, 0, 0]
const WHITE: Vector = [255, 255, 255]
const PALETTE: Vector[] = [BLACK, WHITE]

/** One red pixel. Nearest palette entry is BLACK (index 0), not WHITE. */
function redPixel(): Uint8ClampedArray {
  return new Uint8ClampedArray([255, 0, 0, 255])
}

function firstPixel(out: Uint8ClampedArray): [number, number, number] {
  return [out[0], out[1], out[2]]
}

describe('mapAndDither with an explicit source colour mapping', () => {
  afterEach(() => {
    clearColorMapping()
  })

  it('maps by nearest colour when no mapping is supplied', () => {
    const out = mapAndDither(
      redPixel(),
      1,
      1,
      PALETTE,
      { mode: 'none', intensity: 0 },
      'RGB'
    )

    expect(firstPixel(out)).toEqual([0, 0, 0])
  })

  it('honours the mapping it is given over the nearest colour', () => {
    const out = mapAndDither(
      redPixel(),
      1,
      1,
      PALETTE,
      { mode: 'none', intensity: 0 },
      'RGB',
      new Map([['255,0,0', 1]])
    )

    expect(firstPixel(out)).toEqual([255, 255, 255])
  })

  it('suppresses dithering while a mapping is in force', () => {
    const out = mapAndDither(
      redPixel(),
      1,
      1,
      PALETTE,
      { mode: 'floydSteinberg', intensity: 1 },
      'RGB',
      new Map([['255,0,0', 1]])
    )

    expect(firstPixel(out)).toEqual([255, 255, 255])
  })

  it('falls back to nearest colour for a source colour the mapping misses', () => {
    const out = mapAndDither(
      redPixel(),
      1,
      1,
      PALETTE,
      { mode: 'none', intensity: 0 },
      'RGB',
      new Map([['1,2,3', 1]])
    )

    expect(firstPixel(out)).toEqual([0, 0, 0])
  })

  it('ignores a mapping left behind in the ambient transport', () => {
    // The regression: a previous image's mapping must not reach this call.
    setColorMapping(new Map([['255,0,0', 1]]))

    const out = mapAndDither(
      redPixel(),
      1,
      1,
      PALETTE,
      { mode: 'none', intensity: 0 },
      'RGB'
    )

    expect(firstPixel(out)).toEqual([0, 0, 0])
  })
})
