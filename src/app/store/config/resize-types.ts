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
}

/**
 * Get normalized canvas dimensions for origin mode with aspect ratio correction
 *
 * En mode origin, on veut que l'image source respecte le pixel aspect ratio.
 * Le canvas doit avoir les dimensions CPC natives (160, 320, 640).
 * C'est lors de l'affichage que le pixel aspect ratio sera appliqué.
 */
export function getNormalizedTargetSize(mode: CPCMode): {
  width: number
  height: number
} {
  const modeKey = mode.toString() as '0' | '1' | '2'
  const config = CPC_MODE_CONFIG[modeKey]

  const ratio = config.scaleX / config.scaleY
  // Utiliser les dimensions CPC natives
  return {
    width: config.width * ratio, // 160, 320, ou 640
    height: config.height // Toujours 200
  }
}
