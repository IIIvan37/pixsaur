/**
 * Mode R Preview - Barrel Exports
 *
 * Mode R doubles horizontal resolution by alternating two images at 50Hz
 * with line-by-line interlaced pixel extraction.
 *
 * Module structure:
 * - mode-r/mode-r-preview.ts: All Mode R atoms and functions
 */

// Re-export everything from mode-r folder
export {
  modeRConfigAtom,
  modeRExportDataAtom,
  modeRPalettesAtom,
  modeRPreviewImageAtom,
  modeRQuantizationAtom,
  modeRSourceImageAtom,
  resizeForModeRAuto,
  resizeForModeROrigin
} from './mode-r'
