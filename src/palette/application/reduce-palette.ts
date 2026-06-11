/**
 * `reducePalette` use-case — rebuild the user palette from a freshly reduced
 * color set while honoring locked slots (clean-archi strangler-fig).
 *
 * Replaces the inlined orchestration of `setReducedPaletteAtom` in
 * `src/app/store/palette/palette.ts`.
 *
 * No port (like `smoothImage` / `normalizeImage`): a pure, synchronous
 * transformation over plain data. The perceptual-distance and locked-slot
 * helpers (`isColorTooClose`, `extractLockedColors`) are deterministic domain
 * functions invoked directly.
 *
 * Returns the new `PaletteSlot[]` directly (total, no `Result` union, no
 * change-detection): the adapter writes it through `userPaletteAtom`, whose
 * setter already short-circuits a storage write when the palette is unchanged.
 *
 * Living registry: see `./README.md`.
 */

import {
  extractLockedColors,
  isColorTooClose,
  type PaletteSlot
} from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'

/** Total number of palette slots persisted regardless of the active mode. */
const TOTAL_SLOTS = 16

export interface ReducePaletteInput {
  /** Newly reduced colors to distribute into the unlocked slots. */
  reduced: Vector<'RGB'>[]
  /** Current palette (locked slots are preserved). */
  prev: PaletteSlot[]
  /** Color budget of the active CPC mode (`modeConfig.nColors`). */
  maxColors: number
}

/**
 * Distributes `reduced` colors into the palette, preserving locked slots.
 *
 * Locked slots inside the mode budget are kept verbatim; the remaining
 * unlocked slots are filled, in order, from `reduced` after dropping any color
 * too close to a locked one (visual-duplicate guard). Slots beyond the mode
 * budget are cleared to empty but keep their locked flag, so toggling modes
 * doesn't silently lose a user's lock.
 */
export function reducePalette(input: ReducePaletteInput): PaletteSlot[] {
  const { reduced, prev, maxColors } = input

  const lockedVecs = extractLockedColors(prev)
  const queue = reduced.filter((vec) => !isColorTooClose(vec, lockedVecs))

  const newSlots: PaletteSlot[] = []
  for (let i = 0; i < maxColors; i++) {
    if (prev[i]?.locked) {
      // Keep the locked slot exactly as-is.
      newSlots[i] = { ...prev[i] }
    } else {
      // Otherwise draw the next available reduced color.
      const vec = queue.shift() ?? null
      newSlots[i] = { color: vec, locked: false }
    }
  }

  // Pad up to the full slot count, clearing colors outside the active mode but
  // preserving each slot's locked flag.
  while (newSlots.length < TOTAL_SLOTS) {
    const idx = newSlots.length
    newSlots.push({ color: null, locked: prev[idx]?.locked ?? false })
  }

  return newSlots
}
