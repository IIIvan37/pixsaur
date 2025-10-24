/**
 * Resize Types for Pixsaur
 * Simplified version - dimensions are calculated automatically from CPC mode
 */

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
 * Get default target dimensions for CPC mode
 */
export function getDefaultTargetSize(mode: CPCMode): {
  width: number
  height: number
} {
  switch (mode) {
    case 0:
      return { width: 160, height: 200 } // Mode 0: 160×200
    case 1:
      return { width: 320, height: 200 } // Mode 1: 320×200
    case 2:
      return { width: 640, height: 200 } // Mode 2: 640×200
  }
}
