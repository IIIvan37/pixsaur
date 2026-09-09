/**
 * The hardware colour space, as the conversion works in it.
 *
 * Every pixel lands on a CPC colour before anything else happens (Q26), and the
 * anti-aliasing has to stay inside that space too. Both used to be private
 * helpers of `convert-tileset.ts`, 350 lines apart, each rebuilding the same
 * key-to-index map. Here they are one module, and the map is built once.
 */

import { invariant } from '@/core'
import {
  colorToKey,
  getPaletteForHardware,
  quantizeColorForHardware
} from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { CPCHardware } from '@/libs/types'
import type { Pen } from './pens'

/** Base-palette index of every pixel of a tile, once snapped to the hardware. */
export type SnappedTile = Uint16Array

/**
 * Marks a pixel as a hole while it travels as a base-palette index. Safely out
 * of range: the widest base palette, CPC Plus, stops at 4095.
 */
export const HOLE = 0xffff

/** Below this, a pixel is a hole rather than a colour to composite. */
const OPACITY_THRESHOLD = 128

/** What becomes of the alpha channel while a tile is snapped (Q16). */
export interface AlphaHandling {
  /** The colour a translucent pixel is composited over. */
  background: Pen
  /** Whether a pixel too faint to composite becomes a hole instead. */
  marksHoles: boolean
}

export interface HardwareColours {
  /** Every colour the hardware can show — 27 on classic, 4096 on Plus. */
  palette: Vector[]
  /**
   * Snaps each pixel of a tile onto that palette and reports its position in
   * it. The snap is componentwise, so the result always exists there.
   */
  snap(data: Uint8ClampedArray, alpha: AlphaHandling): SnappedTile
  /**
   * Averages the colours of the given base-palette indices and snaps the result
   * back, so the anti-aliasing stays inside the space every other pass works in.
   */
  blend(sides: readonly number[]): number
}

export function hardwareColours(hardware: CPCHardware): HardwareColours {
  const palette = getPaletteForHardware(hardware)
  const indexByKey = new Map(
    palette.map((colour, index) => [colorToKey(colour), index])
  )

  const indexOf = (colour: Vector, what: string): number => {
    const index = indexByKey.get(
      colorToKey(quantizeColorForHardware(colour, hardware))
    )
    invariant(index !== undefined, `${what} is off the hardware palette`)
    return index
  }

  return {
    palette,

    snap(data, { background, marksHoles }) {
      const snapped = new Uint16Array(data.length / 4)

      for (let pixel = 0; pixel < snapped.length; pixel++) {
        const at = pixel * 4
        if (marksHoles && data[at + 3] < OPACITY_THRESHOLD) {
          snapped[pixel] = HOLE
          continue
        }

        const opacity = data[at + 3] / 255
        const flattened = background.map(
          (behind, channel) =>
            data[at + channel] * opacity + behind * (1 - opacity)
        ) as Vector
        snapped[pixel] = indexOf(flattened, 'snapped colour')
      }

      return snapped
    },

    blend(sides) {
      const mixed = [0, 1, 2].map(
        (channel) =>
          sides.reduce((sum, side) => sum + palette[side][channel], 0) /
          sides.length
      ) as Vector
      return indexOf(mixed, 'blended colour')
    }
  }
}
