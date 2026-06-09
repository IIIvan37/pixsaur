/**
 * Separable horizontal resampler in linear light.
 *
 * Downscaling (e.g. CPC mode 0: ~320 -> 160 wide) is a 2:1 resampling: filter
 * then decimate. Doing it in gamma/sRGB space darkens and dirties fine detail;
 * this resampler converts to linear light, applies a reconstruction filter over
 * the horizontal axis, then re-encodes to sRGB. The vertical axis is never
 * touched — output is `destWidth × src.height`.
 */

import { linearToSrgb, srgbToLinear } from '@/libs/pixsaur-color/src/space'

export type ResampleFilter = 'box' | 'tent' | 'lanczos2'

// Filter radius in *destination* space (scaled by the resampling ratio to get
// the source-space support). Tent at radius 1 gives a ~3px triangular footprint
// at a 2:1 ratio, per spec.
const FILTER_RADIUS: Record<ResampleFilter, number> = {
  box: 0.5,
  tent: 1,
  lanczos2: 2
}

function sinc(x: number): number {
  if (x === 0) return 1
  const px = Math.PI * x
  return Math.sin(px) / px
}

function kernel(filter: ResampleFilter, t: number): number {
  const a = Math.abs(t)
  switch (filter) {
    case 'box':
      return a <= 0.5 ? 1 : 0
    case 'tent':
      return a < 1 ? 1 - a : 0
    case 'lanczos2':
      return a < 2 ? sinc(t) * sinc(t / 2) : 0
  }
}

// sRGB(0-255) -> linear LUT, built once (input is always an 8-bit integer).
const SRGB_TO_LINEAR_LUT = (() => {
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = srgbToLinear(i / 255)
  }
  return lut
})()

interface ColumnTaps {
  readonly indices: number[]
  readonly weights: number[]
}

/**
 * Precompute the source taps + normalized weights for each destination column.
 * The same set applies to every row, so this runs once per resample.
 */
function buildColumnTaps(
  srcWidth: number,
  destWidth: number,
  filter: ResampleFilter
): ColumnTaps[] {
  const ratio = srcWidth / destWidth
  const support = FILTER_RADIUS[filter] * ratio
  const columns: ColumnTaps[] = []

  for (let dx = 0; dx < destWidth; dx++) {
    const center = (dx + 0.5) * ratio - 0.5
    const start = Math.floor(center - support)
    const end = Math.ceil(center + support)

    const indices: number[] = []
    const weights: number[] = []
    let sum = 0

    for (let sx = start; sx <= end; sx++) {
      const w = kernel(filter, (sx - center) / ratio)
      if (w === 0) continue
      // Edge clamp: replicate the border pixel for out-of-range taps.
      const clamped = sx < 0 ? 0 : sx > srcWidth - 1 ? srcWidth - 1 : sx
      indices.push(clamped)
      weights.push(w)
      sum += w
    }

    // Normalize so Σw = 1 (energy preservation, also fixes clamped edges).
    if (sum > 0) {
      for (let i = 0; i < weights.length; i++) weights[i] /= sum
    }

    columns.push({ indices, weights })
  }

  return columns
}

export function resampleHorizontalLinear(
  src: ImageData,
  destWidth: number,
  filter: ResampleFilter
): ImageData {
  const { width: srcWidth, height, data } = src
  const out = new ImageData(destWidth, height)
  const columns = buildColumnTaps(srcWidth, destWidth, filter)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * srcWidth
    for (let dx = 0; dx < destWidth; dx++) {
      const { indices, weights } = columns[dx]
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let i = 0; i < indices.length; i++) {
        const srcIdx = (rowOffset + indices[i]) * 4
        const w = weights[i]
        r += SRGB_TO_LINEAR_LUT[data[srcIdx]] * w
        g += SRGB_TO_LINEAR_LUT[data[srcIdx + 1]] * w
        b += SRGB_TO_LINEAR_LUT[data[srcIdx + 2]] * w
        a += data[srcIdx + 3] * w // alpha is linear already
      }

      const destIdx = (y * destWidth + dx) * 4
      out.data[destIdx] = Math.round(clamp01(linearToSrgb(r)) * 255)
      out.data[destIdx + 1] = Math.round(clamp01(linearToSrgb(g)) * 255)
      out.data[destIdx + 2] = Math.round(clamp01(linearToSrgb(b)) * 255)
      out.data[destIdx + 3] = Math.round(a)
    }
  }

  return out
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
