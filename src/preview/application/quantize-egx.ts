/**
 * `quantizeEgx` use-case — EGX dithering + index-buffer generation
 * (post-review remediation, candidate 1 of `docs/refactor/architecture-review-2026-08.md`).
 *
 * Replaces the inlined orchestration of `egxIndexBufferAtom` in
 * `src/app/store/preview/egx/egx-index-buffer.ts` (an 80-line pixel loop).
 *
 * EGX alternates video modes line by line, so a pixel's constraints depend on
 * its line: the high-resolution lines may only address the shared low inks
 * (INK 0-3 for EGX1, 0-1 for EGX2), and the low-resolution lines are half as
 * wide, so their pixels come in pairs that must share one ink.
 *
 * **No port** (like `buildIndexBuffer` / `normalizeImage`): every step is a
 * deterministic function from `@/libs/pixsaur-egx`. **Synchronous** — the
 * driving atom stays async only to await its upstream pipeline atoms.
 *
 * Living registry: see `./README.md`.
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import {
  applyEGXDitheringByMode,
  findClosestInSubset,
  getMaxColorIndex,
  getModeForLine
} from '@/libs/pixsaur-egx'
import type { IndexBuffer } from './build-index-buffer'

export interface QuantizeEgxInput {
  /** Image normalized to EGX dimensions (RGBA `ImageData`). */
  normalized: ImageData
  /** EGX palette, already ordered so the shared inks come first. */
  palette: Vector<'RGB'>[]
  /** EGX configuration — type, first-line mode, dithering corrections. */
  config: EGXConfig
  /** User dithering settings; `mode` selects the EGX-aware ditherer. */
  dithering: { mode: string; intensity: number }
}

export type QuantizeEgxResult =
  | { ok: true; indexBuffer: IndexBuffer }
  | { ok: false; error: string }

/**
 * Dithers the normalized image with EGX line constraints, then converts the
 * result to one palette index per pixel.
 *
 * Low-resolution lines are walked two pixels at a time: the pair is averaged,
 * matched once against the line's sub-palette, and both pixels get that index
 * (a low-res pixel physically covers two high-res columns). An odd trailing
 * pixel falls through to the single-pixel branch.
 */
export function quantizeEgx(input: QuantizeEgxInput): QuantizeEgxResult {
  const { normalized, palette, config, dithering } = input

  if (palette.length === 0) {
    return { ok: false, error: 'empty EGX palette' }
  }

  const { width, height } = normalized

  const ditheredBuffer = applyEGXDitheringByMode(
    normalized,
    palette,
    config,
    dithering.mode,
    dithering.intensity
  )

  const buffer = new Uint8Array(width * height)

  // High-res mode for this EGX type (Mode 1 for EGX1, Mode 2 for EGX2).
  const highResMode = config.type === 'egx1' ? 1 : 2

  for (let y = 0; y < height; y++) {
    const lineMode = getModeForLine(y, config)
    const maxColorIndex = getMaxColorIndex(lineMode, config.type)
    const isLowResLine = lineMode !== highResMode
    const step = isLowResLine ? 2 : 1

    for (let x = 0; x < width; x += step) {
      const pixelIdx = y * width + x
      const rgbaIdx = pixelIdx * 4

      if (isLowResLine && x + 1 < width) {
        const nextRgbaIdx = rgbaIdx + 4

        const avgPixel: Vector<'RGB'> = [
          Math.round(
            (ditheredBuffer[rgbaIdx] + ditheredBuffer[nextRgbaIdx]) / 2
          ),
          Math.round(
            (ditheredBuffer[rgbaIdx + 1] + ditheredBuffer[nextRgbaIdx + 1]) / 2
          ),
          Math.round(
            (ditheredBuffer[rgbaIdx + 2] + ditheredBuffer[nextRgbaIdx + 2]) / 2
          )
        ]

        const { index } = findClosestInSubset(avgPixel, palette, maxColorIndex)

        buffer[pixelIdx] = index
        buffer[pixelIdx + 1] = index
        continue
      }

      const pixel: Vector<'RGB'> = [
        ditheredBuffer[rgbaIdx],
        ditheredBuffer[rgbaIdx + 1],
        ditheredBuffer[rgbaIdx + 2]
      ]

      const { index } = findClosestInSubset(pixel, palette, maxColorIndex)
      buffer[pixelIdx] = index
    }
  }

  return { ok: true, indexBuffer: { buffer, width, height, palette } }
}
