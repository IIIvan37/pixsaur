/**
 * Preview Store - Hub Module
 *
 * Central module that re-exports all preview-related atoms.
 * The preview pipeline is decomposed into specialized modules:
 *
 * - canvas-size.ts: Preview canvas dimensions based on CPC mode
 * - image-pipeline.ts: Image transformation pipeline (crop → resize → smooth)
 * - manual-edits.ts: Manual pixel edits for preview editor
 * - quantization.ts: Color quantization and palette extraction
 * - palette-export.ts: Palette reconstruction for display and export
 * - preview-image.ts: Dithering and final preview image generation
 * - index-buffer.ts: Index buffer generation and final preview
 *
 * Pipeline Overview:
 * sourceImage → crop → resize → smooth → quantize → dither → indexBuffer → manualEdits → finalPreview
 */

// ============================================================================
// RE-EXPORTS FROM SPECIALIZED MODULES
// ============================================================================

// Re-export IGNORED_SLOT for backward compatibility
export { IGNORED_SLOT } from '@/domain/cpc'
// Canvas size (ISP: preview dimensions)
export { previewCanvasSizeAtom, previewCanvasWidthAtom } from './canvas-size'
// Image pipeline (ISP: image transformations)
export {
  croppedImageAtom,
  resizedImageAtom,
  smoothedImageAtom
} from './image-pipeline'
// Index buffer (ISP: index buffer and final preview)
export {
  finalPreviewImageAtom,
  finalPreviewIndexBufferAtom,
  previewIndexBufferAtom,
  previewVersionAtom
} from './index-buffer'
// Manual edits (ISP: preview editor modifications)
export type { IndexBufferData } from './manual-edits'
export {
  applyManualEditsAtom,
  applyManualEditsToBuffer,
  clearManualEditsAtom,
  hasManualEditsAtom,
  manualEditsCountAtom,
  manualPixelEditsAtom
} from './manual-edits'
// Palette export (ISP: palette for display and export)
export {
  displayPaletteAtom,
  exportPaletteWithSlotsAtom
} from './palette-export'
// Preview image (ISP: dithering and preview generation)
export {
  effectiveDitheringAtom,
  normalizedImageAtom,
  positionedNormalizedImageAtom,
  positionImageForAutoMode,
  previewImageAtom
} from './preview-image'
// Quantization (ISP: color quantization)
export {
  croppedBufferAtom,
  quantizerAtom,
  reducedPaletteRawAtom,
  reducedPaletteRgbAtom,
  sourceUniqueColorsCountAtom
} from './quantization'
