/**
 * Manual Edits Atoms
 *
 * Single responsibility: Manual pixel edits for preview editor
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Index buffer with metadata
 */
export type IndexBufferData = {
  buffer: Uint8Array
  width: number
  height: number
  palette: Vector[]
}

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * Store manual pixel edits from preview editor
 * Map: "x,y" -> inkIndex
 * Reset when source image or preview changes
 */
export const manualPixelEditsAtom = atom<Map<string, number>>(new Map())

/**
 * Indicates if there are unsaved manual edits
 */
export const hasManualEditsAtom = atom(
  (get) => get(manualPixelEditsAtom).size > 0
)

/**
 * Number of manual edits
 */
export const manualEditsCountAtom = atom(
  (get) => get(manualPixelEditsAtom).size
)

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Clear all manual edits
 */
export const clearManualEditsAtom = atom(null, (_get, set) => {
  set(manualPixelEditsAtom, new Map())
  logger.info('[Preview] Manual edits cleared')
})

/**
 * Apply a complete modified buffer
 * Compares with original buffer and stores differences
 */
export const applyManualEditsAtom = atom(
  null,
  (
    _get,
    set,
    editedBuffer: Uint8Array,
    originalBuffer: Uint8Array,
    width: number,
    height: number
  ) => {
    const edits = new Map<string, number>()

    // Find modified pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (editedBuffer[idx] !== originalBuffer[idx]) {
          edits.set(`${x},${y}`, editedBuffer[idx])
        }
      }
    }

    set(manualPixelEditsAtom, edits)
    logger.info('[Preview] Manual edits applied', { editCount: edits.size })
  }
)

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Apply manual edits to an index buffer
 * @param baseBuffer - Original buffer (unmodified)
 * @param edits - Map of modifications "x,y" -> inkIndex
 * @returns Copy of buffer with modifications applied, or original if no edits
 */
export function applyManualEditsToBuffer(
  baseBuffer: IndexBufferData,
  edits: Map<string, number>
): IndexBufferData {
  if (edits.size === 0) return baseBuffer

  const modifiedBuffer = new Uint8Array(baseBuffer.buffer)

  for (const [key, inkIndex] of edits) {
    const [x, y] = key.split(',').map(Number)
    const idx = y * baseBuffer.width + x
    if (idx >= 0 && idx < modifiedBuffer.length) {
      modifiedBuffer[idx] = inkIndex
    }
  }

  return {
    ...baseBuffer,
    buffer: modifiedBuffer
  }
}
