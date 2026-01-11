/**
 * Preview Store - Hub Module
 *
 * Central module that re-exports all preview-related atoms.
 * The preview pipeline is decomposed into specialized modules organized in folders:
 *
 * Folder structure:
 * - pipeline/: Core preview pipeline (crop → resize → quantize → dither → index)
 * - egx/: EGX mode (line-by-line mode alternation)
 * - mode-r/: Mode R (dual-image interlaced rendering)
 * - __tests__/: Test files
 *
 * Pipeline Overview:
 * sourceImage → crop → resize → smooth → quantize → dither → indexBuffer → manualEdits → finalPreview
 */

// ============================================================================
// RE-EXPORTS FROM PIPELINE
// ============================================================================

// Re-export IGNORED_SLOT for backward compatibility
export { IGNORED_SLOT } from '@/domain/cpc'

// Re-export everything from pipeline
export {
  applyManualEditsAtom,
  applyManualEditsToBuffer,
  clearManualEditsAtom,
  // Quantization
  croppedBufferAtom,
  // Image pipeline
  croppedImageAtom,
  // Palette export
  displayPaletteAtom,
  // Preview image
  effectiveDitheringAtom,
  exportPaletteWithSlotsAtom,
  // Index buffer
  finalPreviewImageAtom,
  finalPreviewIndexBufferAtom,
  hasManualEditsAtom,
  // Manual edits
  type IndexBufferData,
  manualEditsCountAtom,
  manualPixelEditsAtom,
  normalizedImageAtom,
  positionedNormalizedImageAtom,
  positionImageForAutoMode,
  // Canvas size
  previewCanvasSizeAtom,
  previewCanvasWidthAtom,
  previewImageAtom,
  previewIndexBufferAtom,
  previewVersionAtom,
  quantizerAtom,
  reducedPaletteRawAtom,
  reducedPaletteRgbAtom,
  resizedImageAtom,
  smoothedImageAtom,
  sourceUniqueColorsCountAtom
} from './pipeline'
