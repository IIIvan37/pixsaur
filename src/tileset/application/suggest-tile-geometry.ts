/**
 * Advises on the destination tile size (T2 — geometry).
 *
 * The user declares the destination size in whole CPC pixels; the ideal ratio is
 * derived and the residual distortion reported (Q1 · Q7). This use-case's whole
 * job is to say what a CPC pixel of `mode` is shaped like: `CPC_MODE_CONFIG`
 * (`scaleX`/`scaleY`), NOT the physical 4:3 aspect — consistency with the rest
 * of the app. The measuring itself is the lib's.
 * See `docs/features/PLAN-tileset-workshop.md`.
 */

import { CPC_MODE_CONFIG, type CpcModeKey, type PixelMode } from '@/domain/cpc'
import {
  measureTileGeometry,
  type PixelAspect,
  type TileGeometry,
  type TileGrid
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

export function suggestTileGeometry({
  mode,
  ...tiles
}: SuggestTileGeometryInput): TileGeometry {
  const { scaleX, scaleY } = CPC_MODE_CONFIG[`${mode}` as CpcModeKey]

  return measureTileGeometry({
    ...tiles,
    targetPixel: { x: scaleX, y: scaleY }
  })
}
