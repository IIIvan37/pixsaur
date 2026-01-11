/**
 * EGX Preview - Barrel Exports
 *
 * EGX alternates video modes per line (spatial interlacing, no flicker).
 * This module provides all atoms needed for EGX preview and export.
 *
 * Module structure:
 * - egx-config.ts: Configuration and mode settings
 * - egx-image.ts: Image normalization for EGX dimensions
 * - egx-palette.ts: Palette optimization for shared colors
 * - egx-preview-image.ts: Preview image generation with dithering
 * - egx-index-buffer.ts: Index buffer for editor and export
 * - egx-final.ts: Final output with manual edits and export data
 */

// Re-export configuration atoms
export {
  egxConfigAtom,
  egxModeConfigAtom,
  getEGXModeConfig
} from './egx-config'
// Re-export final output and export
export { egxExportDataAtom, finalEgxPreviewImageAtom } from './egx-final'
// Re-export image processing
export { egxNormalizedImageAtom } from './egx-image'
// Re-export index buffer atoms
export { egxIndexBufferAtom, finalEgxIndexBufferAtom } from './egx-index-buffer'
// Re-export palette atoms and helpers
export {
  analyzeHighResLineColors,
  egxDisplayPaletteAtom,
  egxPaletteAtom,
  optimizePaletteForEGX
} from './egx-palette'
// Re-export preview image
export { egxPreviewImageAtom, shouldGrayOut } from './egx-preview-image'
