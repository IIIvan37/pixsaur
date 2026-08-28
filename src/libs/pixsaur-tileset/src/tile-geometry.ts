/**
 * Tile geometry: how much a destination tile size distorts the source shape.
 *
 * Neither the source pixel nor the CPC pixel is square, so a tile keeps its
 * shape only when `width x height x pixelAspect` matches on both sides. This
 * module knows nothing of the CPC — the destination pixel arrives as a
 * parameter. See `docs/features/PLAN-tileset-workshop.md` (Q1 · Q7 · Q8).
 */

import type { PixelAspect } from './pixel-aspect'
import type { TileGrid } from './slice-sheet'

/** A tile size together with the shape of the pixels it is made of. */
export interface TileShape {
  tile: TileGrid
  pixel: PixelAspect
}

/** Physical width divided by physical height of the whole tile. */
function physicalAspect({ tile, pixel }: TileShape): number {
  return (tile.tileWidth * pixel.x) / (tile.tileHeight * pixel.y)
}

/**
 * The exact destination height that preserves the source shape at
 * `tileWidth` — generally fractional, which is why a residual distortion
 * remains once the user rounds it to whole CPC pixels.
 */
export function idealTileHeight(
  source: TileShape,
  targetPixel: PixelAspect,
  tileWidth: number
): number {
  return (tileWidth * targetPixel.x) / (physicalAspect(source) * targetPixel.y)
}

/** The mirror of {@link idealTileHeight}, for a height the user pinned. */
export function idealTileWidth(
  source: TileShape,
  targetPixel: PixelAspect,
  tileHeight: number
): number {
  return (physicalAspect(source) * tileHeight * targetPixel.y) / targetPixel.x
}

/**
 * Signed relative width error of `target` against `source`: `+1` means the
 * destination tile is twice as wide, relative to its height, as the source was.
 */
export function aspectDistortion(source: TileShape, target: TileShape): number {
  return physicalAspect(target) / physicalAspect(source) - 1
}

/** An integer destination size, with the distortion it leaves behind. */
export interface TileSizeCandidate extends TileGrid {
  distortion: number
}

/** How far either side of the requested size the search looks. */
const DEFAULT_NEIGHBOURHOOD = 2

/**
 * Whole-pixel destination sizes near `around`, least distorted first; ties go
 * to the size closest to what the user asked for, so an already-perfect
 * request is never talked out of itself.
 */
export function candidateTileSizes(
  source: TileShape,
  targetPixel: PixelAspect,
  around: TileGrid,
  radius: number = DEFAULT_NEIGHBOURHOOD
): TileSizeCandidate[] {
  const candidates: TileSizeCandidate[] = []

  for (
    let tileWidth = Math.max(1, around.tileWidth - radius);
    tileWidth <= around.tileWidth + radius;
    tileWidth++
  ) {
    for (
      let tileHeight = Math.max(1, around.tileHeight - radius);
      tileHeight <= around.tileHeight + radius;
      tileHeight++
    ) {
      candidates.push({
        tileWidth,
        tileHeight,
        distortion: aspectDistortion(source, {
          tile: { tileWidth, tileHeight },
          pixel: targetPixel
        })
      })
    }
  }

  const drift = ({ tileWidth, tileHeight }: TileGrid) =>
    (tileWidth - around.tileWidth) ** 2 + (tileHeight - around.tileHeight) ** 2

  return candidates.sort(
    (a, b) =>
      Math.abs(a.distortion) - Math.abs(b.distortion) || drift(a) - drift(b)
  )
}
