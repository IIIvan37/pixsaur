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
 * En mode origin, on veut que l'image source respecte le pixel aspect ratio.
 * Le canvas doit avoir les dimensions CPC natives (160, 320, 640).
 * C'est lors de l'affichage que le pixel aspect ratio sera appliqué.
 */
export function getNormalizedTargetSize(modeConfig: CpcModeConfig): {
  width: number
  height: number
} {
  const ratio = modeConfig.scaleX / modeConfig.scaleY
  // Utiliser les dimensions de la config (peut être custom ou standard)
  return {
    width: modeConfig.width * ratio,
    height: modeConfig.height
  }
}
