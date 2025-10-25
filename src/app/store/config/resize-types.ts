/**
 * Resize Types for Pixsaur
 * Simplified version - dimensions are calculated automatically from CPC mode
 */

import { CPC_MODE_CONFIG } from './types'

/**
 * CPC mode type (0, 1, or 2)
 */
export type CPCMode = 0 | 1 | 2

/**
 * Resize modes for transforming selection to output
 */
export type ResizeMode =
  | 'auto' // Smart resize with CPC aspect ratio correction (RECOMMENDED)
  | 'origin' // Keep original selection size (pixel-perfect, no scaling)

/**
 * Resize configuration (simplified - no manual dimensions)
 */
export interface ResizeConfig {
  mode: ResizeMode
  cpcMode: CPCMode // Used to calculate target dimensions automatically
  customDimensions?: { width: number; height: number } // Optional custom dimensions override
}

/**
 * Get normalized canvas dimensions for origin mode with aspect ratio correction
 *
 * En mode origin, on veut que l'image source respecte le pixel aspect ratio.
 * Le canvas doit avoir les dimensions CPC natives (160, 320, 640).
 * C'est lors de l'affichage que le pixel aspect ratio sera appliqué.
 *
 * @param mode CPC mode (0, 1, or 2)
 * @param customDimensions Optional custom dimensions to override defaults
 */
export function getNormalizedTargetSize(
  mode: CPCMode,
  customDimensions?: { width: number; height: number }
): {
  width: number
  height: number
} {
  const modeKey = mode.toString() as '0' | '1' | '2'
  const config = CPC_MODE_CONFIG[modeKey]

  const ratio = config.scaleX / config.scaleY

  // Use custom dimensions if provided, otherwise use CPC standard dimensions
  // Standard dimensions: Mode 0 = 160×200, Mode 1 = 320×200, Mode 2 = 640×200
  const standardDimensions = {
    0: { width: 160, height: 200 },
    1: { width: 320, height: 200 },
    2: { width: 640, height: 200 }
  }

  const baseWidth = customDimensions?.width ?? standardDimensions[mode].width
  const baseHeight = customDimensions?.height ?? standardDimensions[mode].height

  return {
    width: baseWidth * ratio,
    height: baseHeight
  }
}
