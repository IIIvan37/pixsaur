import { useDebouncedPersistence } from '@/app/store/workshop/use-debounced-persistence'
import {
  captureSessionAtom,
  loadSnapshot,
  persistSnapshot,
  restoreSessionAtom
} from './session'

const storage = { load: loadSnapshot, save: persistSnapshot }

/**
 * Auto-restores the previous working session on mount and auto-saves it
 * (debounced) on every change, so a reload or app restart no longer wipes the
 * user's image, settings and manual edits.
 */
export function useSessionPersistence() {
  useDebouncedPersistence({
    capture: captureSessionAtom,
    restore: restoreSessionAtom,
    storage
  })
}
