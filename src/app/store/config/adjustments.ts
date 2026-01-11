/**
 * Image Adjustments Configuration
 *
 * Single responsibility: Color and tone adjustments for source image
 */

import { atom } from 'jotai'
import type { AdjustementKey } from './types'

// Default values (multiplicative factors)
const defaultAdjustments: { [key in AdjustementKey]: number } & {
  lastChangedKey: AdjustementKey | null
} = {
  red: 1,
  green: 1,
  blue: 1,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0, // -180 to +180 degrees
  vibrance: 0, // -100 to +100
  temperature: 0, // -100 to +100 (blue/orange)
  tint: 0, // -100 to +100 (green/magenta)
  gamma: 1, // 0.1 to 3.0
  exposure: 0, // -3 to +3 stops
  highlights: 0, // -100 to +100
  shadows: 0, // -100 to +100
  posterization: 256,
  lastChangedKey: null
}

/**
 * Main adjustments atom
 */
export const adjustmentsAtom = atom<typeof defaultAdjustments>({
  ...defaultAdjustments
})

/**
 * Setter for a single adjustment value
 */
export const setAdjustmentAtom = atom(
  null,
  (get, set, payload: { key: AdjustementKey; value: number }) => {
    const prev = get(adjustmentsAtom)
    set(adjustmentsAtom, {
      ...prev,
      [payload.key]: payload.value,
      lastChangedKey: payload.key
    })
  }
)

/**
 * Clear only the last changed key (for tracking purposes)
 */
export const clearLastChangedKeyAtom = atom(null, (_get, set) => {
  set(adjustmentsAtom, (prev) => ({ ...prev, lastChangedKey: null }))
})

/**
 * Reset all adjustments to default values
 */
export const resetAdjustmentsAtom = atom(null, (_get, set) => {
  set(adjustmentsAtom, { ...defaultAdjustments })
})

// ============================================================================
// Compatibility aliases (used by existing code)
// ============================================================================

/** Alias for adjustmentsAtom - used by image adjustment components */
export const configAtom = adjustmentsAtom

/** Alias for setAdjustmentAtom - used by adjustment sliders */
export const setComponentAtom = setAdjustmentAtom

/** Alias for resetAdjustmentsAtom - used by reset button */
export const resetImageAdjustmentsAtom = resetAdjustmentsAtom
