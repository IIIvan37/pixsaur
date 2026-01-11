/**
 * Raster Store - Barrel Exports
 *
 * Per-line palette modifications for enhanced color representation.
 * Raster changes allow modifying ink colors at specific scan lines,
 * enabling more than 4/16 colors in an image.
 *
 * Module structure:
 * - raster-config.ts: Primitive configuration atoms
 * - raster-index-buffer.ts: Index buffer management
 * - raster-changes.ts: CRUD operations and conflict detection
 * - raster-preview.ts: Preview image generation
 * - raster-optimizer.ts: Auto-optimization algorithm
 * - raster-signature.ts: Input change detection
 */

// Re-export change management atoms
export {
  addRasterChangeAtom,
  clearRasterChangesAtom,
  generateChangeId,
  rasterConflictsAtom,
  removeRasterChangeAtom,
  updateRasterChangeAtom
} from './raster-changes'
// Re-export primitive config atoms
export {
  rasterChangesAtom,
  rasterDitheringIntensityAtom,
  rasterEnabledAtom,
  rasterMaxChangesPerLineAtom
} from './raster-config'
// Re-export index buffer atoms
export {
  effectiveIndexBufferAtom,
  finalRasterIndexBufferAtom,
  hasGeneratedRastersAtom,
  rasterBasePaletteAtom,
  rasterIndexBufferAtom,
  rasterOptimizationResultAtom,
  rasterVersionAtom
} from './raster-index-buffer'
// Re-export optimizer
export { autoOptimizeRasterAtom } from './raster-optimizer'
// Re-export preview atoms
export {
  effectivePreviewImageAtom,
  rasterPreviewImageAtom
} from './raster-preview'

// Re-export signature
export { rasterInputSignatureAtom } from './raster-signature'
