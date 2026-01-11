/**
 * CPC Hardware Configuration
 *
 * Single responsibility: CPC hardware selection (Classic vs Plus)
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { CPCHardware } from '@/libs/types'
import { userPaletteAtom } from '../palette/palette'
import type { PaletteSlot } from '../palette/types'

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * CPC Hardware selection - persisted to localStorage
 * Classic: 27 colors (3 levels per RGB component)
 * Plus: 4096 colors (16 levels per RGB component)
 */
export const cpcHardwareAtom = atomWithStorage<CPCHardware>(
  'pixsaur-cpc-hardware',
  'classic'
)

// ============================================================================
// SETTERS
// ============================================================================

/**
 * Setter for CPC Hardware
 * Unlocks all palette colors when hardware changes to ensure consistency
 */
export const setCpcHardwareAtom = atom(
  null,
  (get, set, payload: CPCHardware) => {
    const current = get(cpcHardwareAtom)

    // Unlock all colors when hardware changes
    if (current !== payload) {
      const currentPalette = get(userPaletteAtom)
      const unlockedPalette = currentPalette.map((slot: PaletteSlot) => ({
        ...slot,
        locked: false
      }))
      set(userPaletteAtom, unlockedPalette)
    }

    set(cpcHardwareAtom, payload)
  }
)
