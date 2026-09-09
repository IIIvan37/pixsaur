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

/** Physical width divided by physical height of a whole tile. */
function physicalAspect(tile: TileGrid, pixel: PixelAspect): number {
  return (tile.tileWidth * pixel.x) / (tile.tileHeight * pixel.y)
}

/**
 * Signed relative width error of a destination tile against a source aspect:
 * `+1` means it is twice as wide, relative to its height, as the source was.
 * The source arrives already reduced to its aspect — every candidate of a
 * search shares it, and recomputing it per candidate says nothing new.
 */
function distortionFrom(
  sourceAspect: number,
  tile: TileGrid,
  pixel: PixelAspect
): number {
  return physicalAspect(tile, pixel) / sourceAspect - 1
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
function candidateTileSizes(
  sourceAspect: number,
  targetPixel: PixelAspect,
  around: TileGrid
): TileSizeCandidate[] {
  const candidates: TileSizeCandidate[] = []
  const radius = DEFAULT_NEIGHBOURHOOD

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
        distortion: distortionFrom(
          sourceAspect,
          { tileWidth, tileHeight },
          targetPixel
        )
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

export interface TileGeometryQuery {
  /** Tile size in the source sheet. */
  source: TileGrid
  /** Shape of a source pixel — a `SOURCE_PIXEL_ASPECT` preset or free entry. */
  sourcePixel: PixelAspect
  /** Shape of a destination pixel. */
  targetPixel: PixelAspect
  /** The destination size asked for, in whole destination pixels. */
  target: TileGrid
}

export interface TileGeometry {
  /** Signed: `+0.09` means the chosen size is 9 % too wide for the source shape. */
  distortion: number
  /**
   * The exact destination height that preserves the source shape at the
   * requested width — generally fractional, which is why a residual distortion
   * remains once the user rounds it to whole pixels.
   */
  idealHeight: number
  /** The mirror of {@link TileGeometry.idealHeight}, for a pinned height. */
  idealWidth: number
  /** Whole-pixel sizes near the request, least distorted first. */
  candidates: TileSizeCandidate[]
}

/** Everything the destination size is worth knowing about, measured at once. */
export function measureTileGeometry({
  source,
  sourcePixel,
  targetPixel,
  target
}: TileGeometryQuery): TileGeometry {
  const aspect = physicalAspect(source, sourcePixel)

  return {
    distortion: distortionFrom(aspect, target, targetPixel),
    idealHeight: (target.tileWidth * targetPixel.x) / (aspect * targetPixel.y),
    idealWidth: (aspect * target.tileHeight * targetPixel.y) / targetPixel.x,
    candidates: candidateTileSizes(aspect, targetPixel, target)
  }
}
