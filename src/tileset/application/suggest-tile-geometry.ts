/**
 * Advises on the destination tile size (T2 — geometry).
 *
 * The user declares the destination size in whole CPC pixels; the ideal ratio is
 * derived and the residual distortion reported (Q1 · Q7). The CPC pixel shape
 * comes from `CPC_MODE_CONFIG` (`scaleX`/`scaleY`), NOT the physical 4:3 aspect —
 * consistency with the rest of the app. See `docs/features/PLAN-tileset-workshop.md`.
 */

import { CPC_MODE_CONFIG, type CpcModeKey, type PixelMode } from '@/domain/cpc'
import {
  aspectDistortion,
  candidateTileSizes,
  idealTileHeight,
  idealTileWidth,
  type PixelAspect,
  type TileGrid,
  type TileSizeCandidate
} from '@/libs/pixsaur-tileset'

export interface SuggestTileGeometryInput {
  /** Tile size in the source sheet. */
  source: TileGrid
  /** Shape of a source pixel — a `SOURCE_PIXEL_ASPECT` preset or free entry (Q8). */
  sourcePixel: PixelAspect
  mode: PixelMode
  /** The destination size the user asked for, in whole CPC pixels. */
  target: TileGrid
}

export interface TileGeometry {
  /** Signed: `+0.09` means the chosen size is 9 % too wide for the source shape. */
  distortion: number
  /** Exact — and generally fractional — height for the width the user chose. */
  idealHeight: number
  /** The mirror of {@link TileGeometry.idealHeight}, for a pinned height. */
  idealWidth: number
  /** Whole-pixel sizes near the request, least distorted first. */
  candidates: TileSizeCandidate[]
}

export function suggestTileGeometry(
  input: SuggestTileGeometryInput
): TileGeometry {
  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${input.mode}` as CpcModeKey]
  const cpcPixel: PixelAspect = { x: scaleX, y: scaleY }

  const source = { tile: input.source, pixel: input.sourcePixel }

  return {
    distortion: aspectDistortion(source, {
      tile: input.target,
      pixel: cpcPixel
    }),
    idealHeight: idealTileHeight(source, cpcPixel, input.target.tileWidth),
    idealWidth: idealTileWidth(source, cpcPixel, input.target.tileHeight),
    candidates: candidateTileSizes(source, cpcPixel, input.target)
  }
}
