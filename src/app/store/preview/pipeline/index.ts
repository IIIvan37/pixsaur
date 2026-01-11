/**
 * Preview Pipeline - Barrel Exports
 *
 * The preview pipeline transforms the source image through several stages:
 * sourceImage → crop → resize → smooth → quantize → dither → indexBuffer → manualEdits → finalPreview
 */

// Canvas size (preview dimensions)
export { previewCanvasSizeAtom, previewCanvasWidthAtom } from './canvas-size'

// Image pipeline (image transformations)
export {
  croppedImageAtom,
  resizedImageAtom,
  smoothedImageAtom
} from './image-pipeline'

// Index buffer (index buffer and final preview)
export {
  finalPreviewImageAtom,
  finalPreviewIndexBufferAtom,
  previewIndexBufferAtom,
  previewVersionAtom
} from './index-buffer'

// Manual edits (preview editor modifications)
export type { IndexBufferData } from './manual-edits'
export {
  applyManualEditsAtom,
  applyManualEditsToBuffer,
  clearManualEditsAtom,
  hasManualEditsAtom,
  manualEditsCountAtom,
  manualPixelEditsAtom
} from './manual-edits'

// Palette export (palette for display and export)
export {
  displayPaletteAtom,
  exportPaletteWithSlotsAtom
} from './palette-export'

// Preview image (dithering and preview generation)
export {
  effectiveDitheringAtom,
  normalizedImageAtom,
  positionedNormalizedImageAtom,
  positionImageForAutoMode,
  previewImageAtom
} from './preview-image'

// Quantization (color quantization)
export {
  croppedBufferAtom,
  quantizerAtom,
  reducedPaletteRawAtom,
  reducedPaletteRgbAtom,
  sourceUniqueColorsCountAtom
} from './quantization'
