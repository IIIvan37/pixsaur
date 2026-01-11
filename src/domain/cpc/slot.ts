/**
 * Palette Slot Types & Operations
 *
 * Single responsibility: Managing palette slot state (locked/unlocked, empty/filled)
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * A slot in the user palette with optional locked state
 */
export interface PaletteSlot {
  color: Vector | null
  locked: boolean
}

/**
 * Extract colors from locked slots (non-empty)
 *
 * @param slots - User palette with slot states
 * @returns Array of locked colors (excludes empty locked slots)
 */
export function extractLockedColors(slots: PaletteSlot[]): Vector[] {
  return slots
    .filter((slot) => slot.locked && slot.color !== null)
    .map((slot) => slot.color!)
}

/**
 * Count empty locked slots in a palette
 *
 * @param slots - User palette with slot states
 * @param maxSlots - Maximum number of slots to consider
 * @returns Number of locked empty slots
 */
export function countLockedEmptySlots(
  slots: PaletteSlot[],
  maxSlots: number = 16
): number {
  return slots
    .slice(0, maxSlots)
    .filter((slot) => slot.locked && slot.color === null).length
}

/**
 * Check if a slot is locked with a color
 */
export function isLockedWithColor(slot: PaletteSlot): boolean {
  return slot.locked && slot.color !== null
}

/**
 * Check if a slot is locked but empty
 */
export function isLockedEmpty(slot: PaletteSlot): boolean {
  return slot.locked && slot.color === null
}
