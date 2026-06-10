/**
 * Separable resampler in linear light.
 *
 * Downscaling (e.g. CPC mode 0: ~320 -> 160 wide, or the 2D scale-to-fit of the
 * auto/cover resize modes) is a resampling: filter then decimate. Doing it in
 * gamma/sRGB space darkens and dirties fine detail; this resampler converts to
 * linear light, applies a reconstruction filter, then re-encodes to sRGB.
 *
 * `resampleLinear` resamples both axes (separable: horizontal pass then vertical
 * pass, with a single sRGB<->linear round-trip). `resampleHorizontalLinear` is a
 * thin wrapper that keeps the height unchanged (used by the mode 0 'origin' path
 * where the vertical axis is 1:1).
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

interface AxisTaps {
  readonly indices: number[]
  readonly weights: number[]
}

/**
 * Precompute source taps + normalized weights for each destination index along
 * one axis. The same set applies to every line, so this runs once per axis.
 * Downscaling only (ratio >= 1): for upscaling the support would shrink, which
 * we never need here.
 */
function buildAxisTaps(
  srcLen: number,
  destLen: number,
  filter: ResampleFilter
): AxisTaps[] {
  const ratio = srcLen / destLen
  // For downscaling, widen the filter support by the ratio; for ratio < 1
  // (no downscale) keep the native support so the result is an identity.
  const scale = Math.max(1, ratio)
  const support = FILTER_RADIUS[filter] * scale
  const taps: AxisTaps[] = []

  for (let d = 0; d < destLen; d++) {
    const center = (d + 0.5) * ratio - 0.5
    const start = Math.floor(center - support)
    const end = Math.ceil(center + support)

    const indices: number[] = []
    const weights: number[] = []
    let sum = 0

    for (let s = start; s <= end; s++) {
      const w = kernel(filter, (s - center) / scale)
      if (w === 0) continue
      // Edge clamp: replicate the border pixel for out-of-range taps.
      const clamped = s < 0 ? 0 : s > srcLen - 1 ? srcLen - 1 : s
      indices.push(clamped)
      weights.push(w)
      sum += w
    }

    // Normalize so Σw = 1 (energy preservation, also fixes clamped edges).
    if (sum > 0) {
      for (let i = 0; i < weights.length; i++) weights[i] /= sum
    }

    taps.push({ indices, weights })
  }

  return taps
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Resample `src` to `destWidth × destHeight` in linear light with the given
 * reconstruction filter. Separable: horizontal pass then vertical pass.
 */
export function resampleLinear(
  src: ImageData,
  destWidth: number,
  destHeight: number,
  filter: ResampleFilter
): ImageData {
  const { width: srcW, height: srcH, data } = src

  // 1. Decode source to linear-light float (alpha normalized to [0,1]).
  const lin = new Float32Array(srcW * srcH * 4)
  for (let i = 0; i < lin.length; i += 4) {
    lin[i] = SRGB_TO_LINEAR_LUT[data[i]]
    lin[i + 1] = SRGB_TO_LINEAR_LUT[data[i + 1]]
    lin[i + 2] = SRGB_TO_LINEAR_LUT[data[i + 2]]
    lin[i + 3] = data[i + 3] / 255
  }

  // 2. Horizontal pass: srcW -> destWidth (intermediate is destWidth × srcH).
  const colTaps = buildAxisTaps(srcW, destWidth, filter)
  const tmp = new Float32Array(destWidth * srcH * 4)
  for (let y = 0; y < srcH; y++) {
    const rowIn = y * srcW * 4
    const rowOut = y * destWidth * 4
    for (let dx = 0; dx < destWidth; dx++) {
      const { indices, weights } = colTaps[dx]
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let k = 0; k < indices.length; k++) {
        const idx = rowIn + indices[k] * 4
        const w = weights[k]
        r += lin[idx] * w
        g += lin[idx + 1] * w
        b += lin[idx + 2] * w
        a += lin[idx + 3] * w
      }
      const o = rowOut + dx * 4
      tmp[o] = r
      tmp[o + 1] = g
      tmp[o + 2] = b
      tmp[o + 3] = a
    }
  }

  // 3. Vertical pass: srcH -> destHeight.
  const rowTaps = buildAxisTaps(srcH, destHeight, filter)
  const out = new ImageData(destWidth, destHeight)
  for (let dx = 0; dx < destWidth; dx++) {
    for (let dy = 0; dy < destHeight; dy++) {
      const { indices, weights } = rowTaps[dy]
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let k = 0; k < indices.length; k++) {
        const idx = (indices[k] * destWidth + dx) * 4
        const w = weights[k]
        r += tmp[idx] * w
        g += tmp[idx + 1] * w
        b += tmp[idx + 2] * w
        a += tmp[idx + 3] * w
      }
      const o = (dy * destWidth + dx) * 4
      out.data[o] = Math.round(clamp01(linearToSrgb(r)) * 255)
      out.data[o + 1] = Math.round(clamp01(linearToSrgb(g)) * 255)
      out.data[o + 2] = Math.round(clamp01(linearToSrgb(b)) * 255)
      out.data[o + 3] = Math.round(clamp01(a) * 255)
    }
  }

  return out
}

/** Resample horizontally only (height unchanged). */
export function resampleHorizontalLinear(
  src: ImageData,
  destWidth: number,
  filter: ResampleFilter
): ImageData {
  return resampleLinear(src, destWidth, src.height, filter)
}
