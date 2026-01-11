/**
 * Mode R Export Data
 *
 * Prepares Mode R data for export.
 */

import { atom } from 'jotai'
import { modeREnabledAtom } from '../../config/config'
import { modeRQuantizationAtom } from './mode-r-quantization'

// ============================================================================
// Mode R Export Data
// ============================================================================

/**
 * Export data for Mode R (used by export pipeline)
 */
export const modeRExportDataAtom = atom(async (get) => {
  const modeREnabled = get(modeREnabledAtom)
  if (!modeREnabled) return null

  const quantResult = await get(modeRQuantizationAtom)
  if (!quantResult) return null

  return {
    indexBufferA: quantResult.indexBufferA,
    indexBufferB: quantResult.indexBufferB,
    paletteA: quantResult.palettes.paletteA,
    paletteB: quantResult.palettes.paletteB,
    stats: quantResult.palettes.stats
  }
})
