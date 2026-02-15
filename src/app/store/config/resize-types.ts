/**
 * Resize Types for Pixsaur
 * Simplified version - dimensions are calculated automatically from CPC mode
 */

import type { CpcModeConfig } from './types'

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
  | 'cover' // Scale to fill target dimensions, cropping excess (crop cover)

/**
 * Resize configuration (simplified - no manual dimensions)
 */
export interface ResizeConfig {
  mode: ResizeMode
  modeConfig: CpcModeConfig // Complete mode config including custom dimensions
}

/**
 * Get normalized canvas dimensions for origin mode with aspect ratio correction
 *
 * Le canvas de preview est toujours 320×200 (aspect ratio CPC standard).
 * - Mode 0 (ratio 2:1) : 160×200 CPC → 320×200 écran (pixels 2x larges)
 * - Mode 1 (ratio 1:1) : 320×200 CPC → 320×200 écran (pixels carrés)
 * - Mode 2 (ratio 0.5:1) : 640×200 CPC → 320×200 écran (pixels 2x hauts)
 */
export function getNormalizedTargetSize(modeConfig: CpcModeConfig): {
  width: number
  height: number
} {
  const ratio = modeConfig.scaleX / modeConfig.scaleY
  return {
    width: modeConfig.width * ratio,
    height: modeConfig.height
  }
}
