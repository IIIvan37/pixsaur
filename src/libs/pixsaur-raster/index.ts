// Core modules
export * from './color-quantization'
export * from './ink-assignment'
export * from './line-palette-optimizer'
// Legacy re-exports for backward compatibility
// TODO: Remove after migration complete
export {
  extractGlobalPaletteFromImage,
  MODE_0_FIXED_COLORS,
  MODE_0_RASTER_SLOTS,
  MODE_0_TOTAL_COLORS,
  type OptimizationOptions,
  type OptimizationResult,
  optimizeLinePalettesWithIndexBuffer,
  quantizeToCPCPlus
} from './line-palette-optimizer'
export * from './median-cut'
export * from './palette-selection'
export * from './preprocess-raster'
export { posterizeImage, preprocessImageForRaster } from './preprocess-raster'
export * from './raster-constants'
export * from './raster-tuning'
export * from './render-with-raster'
export * from './types'
