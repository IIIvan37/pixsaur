export { type AntiAliasOptions, antiAliasTile } from './src/anti-alias'
export {
  type AssembledSheet,
  type AssembleSheetOptions,
  assembleSheet,
  type SheetGutters,
  scaleSheetGutters
} from './src/assemble-sheet'
export { countColours } from './src/count-colours'
export { cropSheet, type SheetRegion } from './src/crop-sheet'
export {
  type DiffuseOptions,
  type DiffusionColours,
  diffuseTile
} from './src/diffuse-tile'
export {
  detectTileEdges,
  type EdgeCondition,
  type TileEdges
} from './src/edge-condition'
export { type EdgeMaskOptions, tileEdgeMask } from './src/edge-mask'
export {
  detectIntegerScale,
  downscaleSheet,
  type IntegerScale
} from './src/integer-scale'
export {
  type BayerSize,
  type OrderedDitherOptions,
  orderedDitherTile,
  type PenMix
} from './src/ordered-dither'
export {
  type ColourWeight,
  tilePaletteHistogram
} from './src/palette-histogram'
export {
  HOLE_PEN,
  type HoleMarking,
  type HoleWriting,
  type PenSpace,
  penSpace
} from './src/pen-space'
export {
  type PenColour,
  type PenTables,
  penTables
} from './src/pen-tables'
export {
  type PixelAspect,
  SOURCE_PIXEL_ASPECT,
  type SourcePlatform
} from './src/pixel-aspect'
export {
  type GridCandidate,
  type GridSearch,
  rankTileGrids
} from './src/rank-grids'
export {
  type OffsetCandidate,
  type OffsetSearch,
  rankTileOffsets
} from './src/rank-tile-offsets'
export {
  type AxisSearch,
  chooseResizeScheme,
  type ResizeScheme,
  resizeTileByScheme
} from './src/resize-scheme'
export { resizeTileNearest } from './src/resize-tile'
export {
  type GridBlanks,
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
export { dedupeTiles, type TileBytes, type TileDedup } from './src/tile-dedup'
export {
  measureTileGeometry,
  type TileGeometry,
  type TileGeometryQuery,
  type TileSizeCandidate
} from './src/tile-geometry'
export { buildTileMap, type TileMap } from './src/tile-map'
export {
  type TiledImage,
  type TiledMapDocument,
  type TiledProperty,
  type TiledTilesetDocument,
  writeTiledMap,
  writeTiledTileset
} from './src/tiled-xml'
