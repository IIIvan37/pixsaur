/**
 * EGX Preview - Barrel Exports
 *
 * EGX alternates video modes per line (spatial interlacing, no flicker).
 * This module provides all atoms needed for EGX preview and export.
 *
 * Module structure:
 * - egx/egx-config.ts: Configuration and mode settings
 * - egx/egx-image.ts: Image normalization for EGX dimensions
 * - egx/egx-palette.ts: Palette optimization for shared colors
 * - egx/egx-preview-image.ts: Preview image generation with dithering
 * - egx/egx-index-buffer.ts: Index buffer for editor and export
 * - egx/egx-final.ts: Final output with manual edits and export data
 */

// Re-export everything from egx folder
export {
  // Palette
  analyzeHighResLineColors,
  // Configuration
  egxConfigAtom,
  egxDisplayPaletteAtom,
  // Final output
  egxExportDataAtom,
  // Index buffer
  egxIndexBufferAtom,
  egxModeConfigAtom,
  // Image processing
  egxNormalizedImageAtom,
  egxPaletteAtom,
  // Preview image
  egxPreviewImageAtom,
  finalEgxIndexBufferAtom,
  finalEgxPreviewImageAtom,
  getEGXModeConfig,
  optimizePaletteForEGX,
  shouldGrayOut
} from './egx'
