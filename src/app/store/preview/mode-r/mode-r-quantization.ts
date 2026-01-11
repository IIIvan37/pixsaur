/**
 * Mode R Quantization
 *
 * Handles color quantization for Mode R dual-frame output.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { ModeRQuantizationResult } from '@/libs/pixsaur-mode-r'
import { quantizeModeR } from '@/libs/pixsaur-mode-r'
import { modeREnabledAtom } from '../../config/config'
import { exportPaletteWithSlotsAtom } from '../preview'
import { modeRConfigAtom } from './mode-r-config'
import { modeRSourceImageAtom } from './mode-r-image'

// ============================================================================
// Mode R Quantization Result
// ============================================================================

/**
 * Mode R quantization result with dual index buffers and palettes
 */
export const modeRQuantizationAtom = atom(
  async (get): Promise<ModeRQuantizationResult | null> => {
    const modeREnabled = get(modeREnabledAtom)
    if (!modeREnabled) return null

    const sourceImage = await get(modeRSourceImageAtom)
    const exportPalette = await get(exportPaletteWithSlotsAtom)
    const config = get(modeRConfigAtom)

    if (!sourceImage || exportPalette.length === 0) return null

    // Filter out ignored slots
    const validPalette = exportPalette.filter(
      (c): c is Vector<'RGB'> => c[0] !== -1 && c[1] !== -1 && c[2] !== -1
    )

    if (validPalette.length === 0) return null

    logger.info('[Mode R] Starting quantization', {
      imageSize: `${sourceImage.width}×${sourceImage.height}`,
      paletteSize: validPalette.length,
      config
    })

    // Pass the existing palette from standard mode as palette A base
    // This preserves important colors like bright yellow that standard mode captured
    const result = quantizeModeR(
      sourceImage.data,
      sourceImage.width,
      sourceImage.height,
      config,
      validPalette
    )

    logger.info('[Mode R] Quantization complete', {
      outputSize: `${Math.floor(sourceImage.width / 2)}×${sourceImage.height}`,
      averageFlicker: result.palettes.stats.averageFlicker.toFixed(2),
      maxFlicker: result.palettes.stats.maxFlicker.toFixed(2),
      noFlickerPairs: result.palettes.stats.noFlickerPairs
    })

    return result
  }
)

// ============================================================================
// Mode R Palettes Atom (for UI display)
// ============================================================================

/**
 * Derived atom exposing just the palettes for UI display
 */
export const modeRPalettesAtom = atom(async (get) => {
  const quantResult = await get(modeRQuantizationAtom)
  if (!quantResult) return null

  // Count unique pairs (A index, B index) actually used in the image
  const usedPairs = new Set<string>()
  for (let i = 0; i < quantResult.indexBufferA.length; i++) {
    const idxA = quantResult.indexBufferA[i]
    const idxB = quantResult.indexBufferB[i]
    usedPairs.add(`${idxA},${idxB}`)
  }

  return {
    paletteA: quantResult.palettes.paletteA,
    paletteB: quantResult.palettes.paletteB,
    stats: quantResult.palettes.stats,
    uniquePairsUsed: usedPairs.size
  }
})
