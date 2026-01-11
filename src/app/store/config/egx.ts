/**
 * EGX Mode Configuration
 *
 * Single responsibility: EGX (Enhanced Graphics) mode configuration
 * EGX combines two pixel modes (line-by-line alternation) to achieve more colors
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type {
  EGXFirstLineMode,
  EGXPreviewMode,
  EGXType
} from '@/libs/pixsaur-egx'

// Re-export types for convenience
export type { EGXFirstLineMode, EGXPreviewMode, EGXType }

// Also export as EgxType for consistency
export type EgxType = EGXType

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * EGX mode enabled state
 * When enabled, uses line-by-line mode alternation (EGX1 or EGX2)
 * Mutually exclusive with Mode R and Raster
 */
export const egxEnabledAtom = atomWithStorage<boolean>(
  'pixsaur-egx-enabled',
  false
)

/**
 * EGX type selection
 * - egx1: Mode 0/1 alternation (320×200, up to 16 colors)
 * - egx2: Mode 1/2 alternation (640×200, up to 4 colors)
 */
export const egxTypeAtom = atomWithStorage<EGXType>('pixsaur-egx-type', 'egx1')

/**
 * EGX first line mode
 * - 'low': First line uses lower resolution mode (more colors)
 * - 'high': First line uses higher resolution mode (fewer colors)
 */
export const egxFirstLineModeAtom = atomWithStorage<EGXFirstLineMode>(
  'pixsaur-egx-first-line-mode',
  'low'
)

/**
 * EGX preview mode
 * - 'combined': Show final combined view
 * - 'highLines': Show only high-resolution lines
 * - 'lowLines': Show only low-resolution lines
 */
export const egxPreviewModeAtom = atom<EGXPreviewMode>('combined')

/**
 * EGX overscan mode
 */
export const egxOverscanAtom = atom<boolean>(false)

// ============================================================================
// DERIVED ATOMS
// ============================================================================

/**
 * Get the two pixel modes used by current EGX type
 */
export const egxModesPairAtom = atom((get) => {
  const egxType = get(egxTypeAtom)
  if (egxType === 'egx1') {
    return { mode1: 0, mode2: 1 } as const
  }
  return { mode1: 1, mode2: 2 } as const
})

// ============================================================================
// SETTERS
// ============================================================================

/**
 * Base setter for EGX enabled (without exclusion logic)
 * Use setEgxEnabledAtom from config.ts for mutual exclusion handling
 */
export const setEgxEnabledBaseAtom = atom(
  null,
  (_get, set, payload: boolean) => {
    set(egxEnabledAtom, payload)
  }
)

/**
 * Base setter for EGX type (without pixel mode adjustment)
 * Use setEgxTypeAtom from config.ts for full handling
 */
export const setEgxTypeBaseAtom = atom(null, (_get, set, payload: EGXType) => {
  set(egxTypeAtom, payload)
})

export const setEgxFirstLineModeAtom = atom(
  null,
  (_get, set, payload: EGXFirstLineMode) => {
    set(egxFirstLineModeAtom, payload)
  }
)

export const setEgxPreviewModeAtom = atom(
  null,
  (_get, set, payload: EGXPreviewMode) => {
    set(egxPreviewModeAtom, payload)
  }
)

export const setEgxOverscanAtom = atom(null, (_get, set, payload: boolean) => {
  set(egxOverscanAtom, payload)
})

/**
 * Reset EGX to default configuration
 */
export const resetEgxAtom = atom(null, (_get, set) => {
  set(egxEnabledAtom, false)
  set(egxTypeAtom, 'egx1')
  set(egxFirstLineModeAtom, 'low')
  set(egxPreviewModeAtom, 'combined')
  set(egxOverscanAtom, false)
})
