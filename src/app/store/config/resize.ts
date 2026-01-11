/**
 * Resize Configuration
 *
 * Single responsibility: Image resize mode settings
 */

import { atom } from 'jotai'
import type { ResizeMode } from './resize-types'

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * Resize mode selection
 * - auto: Smart resize with CPC aspect ratio correction (default)
 * - origin: Original dimensions, pixel-perfect mapping
 */
export const resizeModeAtom = atom<ResizeMode>('auto')

/**
 * Center image in target dimensions
 * When image is smaller than target, center it with margins
 */
export const centerImageAtom = atom<boolean>(true)

// ============================================================================
// SETTERS
// ============================================================================

/**
 * Setter for resize mode
 */
export const setResizeModeAtom = atom(
  null,
  (_get, set, payload: ResizeMode) => {
    set(resizeModeAtom, payload)
  }
)
