/**
 * Finds a capture blown up by a whole factor, and undoes it (M-Q19).
 *
 * An emulator often saves its screen at ×2 or ×3. Read as it is, such a
 * capture makes 8 x 8 tiles of 4 x 4 blocks, and the tile size, the offset
 * and the deduplication are all off by the factor. The test is exact: every
 * block of `factor` x `factor` pixels holds one colour. A filtered capture —
 * bilinear, CRT — fails it, and is meant to: its pixels are not the machine's
 * any more. See `docs/features/PLAN-tileset-map.md`.
 */

import type { Sheet } from './slice-sheet'

export interface IntegerScale {
  /** 1 when the image is drawn at its own size. */
  factor: number
  /** Where the first whole block starts — a capture may be cut off its grid. */
  phaseX: number
  phaseY: number
}

const NO_SCALE: IntegerScale = { factor: 1, phaseX: 0, phaseY: 0 }

function samePixel(data: Uint8ClampedArray, a: number, b: number): boolean {
  return (
    data[a] === data[b] &&
    data[a + 1] === data[b + 1] &&
    data[a + 2] === data[b + 2] &&
    data[a + 3] === data[b + 3]
  )
}

/** Whether every whole block the phase lays on the image holds one colour. */
function blocksAreUniform(sheet: Sheet, scale: IntegerScale): boolean {
  const { factor, phaseX, phaseY } = scale
  const columns = Math.floor((sheet.width - phaseX) / factor)
  const rows = Math.floor((sheet.height - phaseY) / factor)
  // A phase past the edge makes the counts negative: no block, no verdict.
  if (columns <= 0 || rows <= 0) return false

  for (let block = 0; block < columns * rows; block++) {
    const left = phaseX + (block % columns) * factor
    const top = phaseY + Math.floor(block / columns) * factor
    const first = (top * sheet.width + left) * 4

    for (let y = 0; y < factor; y++) {
      for (let x = 0; x < factor; x++) {
        const at = ((top + y) * sheet.width + left + x) * 4
        if (!samePixel(sheet.data, first, at)) return false
      }
    }
  }

  return true
}

/**
 * The largest factor up to `maxFactor` whose blocks are all uniform, at the
 * first phase that makes them so. A ×4 capture is ×2-uniform too, and only
 * the largest factor undoes it.
 */
export function detectIntegerScale(sheet: Sheet, maxFactor = 4): IntegerScale {
  for (let factor = maxFactor; factor >= 2; factor--) {
    for (let phaseY = 0; phaseY < factor; phaseY++) {
      for (let phaseX = 0; phaseX < factor; phaseX++) {
        const scale = { factor, phaseX, phaseY }
        if (blocksAreUniform(sheet, scale)) return scale
      }
    }
  }

  return NO_SCALE
}

/** One pixel per whole block; the strips before the phase are dropped. */
export function downscaleSheet(sheet: Sheet, scale: IntegerScale): Sheet {
  const { factor, phaseX, phaseY } = scale
  const width = Math.floor((sheet.width - phaseX) / factor)
  const height = Math.floor((sheet.height - phaseY) / factor)
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from =
        ((phaseY + y * factor) * sheet.width + phaseX + x * factor) * 4
      data.set(sheet.data.subarray(from, from + 4), (y * width + x) * 4)
    }
  }

  return { width, height, data }
}
