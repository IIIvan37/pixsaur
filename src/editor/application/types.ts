/**
 * Domain types for the editor feature (clean-archi strangler-fig).
 *
 * Owned by the application layer so use-cases stay independent of the Jotai
 * store. The store (`app/store/editor/editor-state.ts`) re-exports these for
 * backward compatibility. Living registry: see `./README.md`.
 */

/**
 * A single pixel mutation: the ink that was there and the ink painted over it.
 */
export interface PixelEdit {
  x: number
  y: number
  previousInkIndex: number
  newInkIndex: number
}

/**
 * One undoable entry in the edit history: a batch of pixel edits applied
 * together (a click, a drag region, or a fill).
 */
export interface EditHistoryEntry {
  type: 'pixel' | 'region' | 'fill'
  edits: PixelEdit[]
  timestamp: number
}

/** Maximum number of entries kept in the undo history. */
export const MAX_HISTORY_SIZE = 100
