/**
 * Mode R Configuration
 *
 * Single responsibility: Mode R (dual-palette interlacing) configuration
 * Mode R creates flicker-free color blending using two palettes
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

// ============================================================================
// TYPES
// ============================================================================

export type ModeRPixelMode = 0 | 1 | 2

export type ModeRPreviewMode = 'blended' | 'frameA' | 'frameB' | 'flicker'

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * Mode R enabled state
 * When enabled, forces Mode 0 and uses dual-palette interlacing
 */
export const modeREnabledAtom = atomWithStorage<boolean>(
  'pixsaur-mode-r-enabled',
  false
)

/**
 * Mode R anti-flicker weight (0-100)
 * Higher values prioritize flicker reduction over color accuracy
 */
export const modeRAntiFlickerAtom = atomWithStorage<number>(
  'pixsaur-mode-r-anti-flicker',
  70
)

/**
 * Mode R maximum luminance delta for color pairs
 * Pairs with higher luminance difference will be penalized
 */
export const modeRMaxLuminanceDeltaAtom = atomWithStorage<number>(
  'pixsaur-mode-r-max-luminance-delta',
  80
)

/**
 * Mode R preview mode
 * - 'blended': Show perceived colors (default)
 * - 'frameA': Show frame A only
 * - 'frameB': Show frame B only
 * - 'flicker': Show flicker heatmap
 */
export const modeRPreviewModeAtom = atom<ModeRPreviewMode>('blended')

/**
 * Mode R dual palette option
 * - false: Same palette for both frames (default, less flicker)
 * - true: Independent palettes for each frame (more colors, more flicker)
 */
export const modeRDualPaletteAtom = atomWithStorage<boolean>(
  'pixsaur-mode-r-dual-palette',
  false
)

// ============================================================================
// SETTERS
// ============================================================================

/**
 * Base setter for Mode R enabled (without exclusion logic)
 * Use setModeREnabledAtom from config.ts for mutual exclusion handling
 */
export const setModeREnabledBaseAtom = atom(
  null,
  (_get, set, payload: boolean) => {
    set(modeREnabledAtom, payload)
  }
)

export const setModeRAntiFlickerAtom = atom(
  null,
  (_get, set, payload: number) => {
    set(modeRAntiFlickerAtom, Math.max(0, Math.min(100, payload)))
  }
)

export const setModeRMaxLuminanceDeltaAtom = atom(
  null,
  (_get, set, payload: number) => {
    set(modeRMaxLuminanceDeltaAtom, Math.max(0, Math.min(255, payload)))
  }
)

export const setModeRPreviewModeAtom = atom(
  null,
  (_get, set, payload: ModeRPreviewMode) => {
    set(modeRPreviewModeAtom, payload)
  }
)

export const setModeRDualPaletteAtom = atom(
  null,
  (_get, set, payload: boolean) => {
    set(modeRDualPaletteAtom, payload)
  }
)

/**
 * Reset Mode R to default configuration
 */
export const resetModeRAtom = atom(null, (_get, set) => {
  set(modeREnabledAtom, false)
  set(modeRAntiFlickerAtom, 70)
  set(modeRMaxLuminanceDeltaAtom, 80)
  set(modeRPreviewModeAtom, 'blended')
  set(modeRDualPaletteAtom, false)
})
