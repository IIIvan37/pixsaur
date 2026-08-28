export {
  detectTileEdges,
  type EdgeCondition,
  type TileEdges
} from './src/edge-condition'
export { type EdgeMaskOptions, tileEdgeMask } from './src/edge-mask'
export {
  type ColourWeight,
  tilePaletteHistogram
} from './src/palette-histogram'
export {
  type PixelAspect,
  SOURCE_PIXEL_ASPECT,
  type SourcePlatform
} from './src/pixel-aspect'
export {
  type GridCandidate,
  PLAUSIBLE_TILE_SIZES,
  rankTileGrids
} from './src/rank-grids'
export {
  chooseResizeScheme,
  type ResizeScheme,
  resizeTileByScheme
} from './src/resize-scheme'
export { resizeTileNearest } from './src/resize-tile'
export {
  type Sheet,
  type SheetGrid,
  type SlicedSheet,
  type SourceTile,
  sliceSheet,
  type TileGrid
} from './src/slice-sheet'
export {
  rankTileCollisions,
  type TileCollision
} from './src/tile-collisions'
export {
  dedupeTiles,
  duplicateRate,
  type TileBytes,
  type TileDedup
} from './src/tile-dedup'
export {
  aspectDistortion,
  candidateTileSizes,
  idealTileHeight,
  idealTileWidth,
  type TileShape,
  type TileSizeCandidate
} from './src/tile-geometry'
