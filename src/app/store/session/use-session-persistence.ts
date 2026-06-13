import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import {
  captureSessionAtom,
  loadSnapshot,
  persistSnapshot,
  restoreSessionAtom
} from './session'

/** Debounce window before a changed session is written back to storage. */
const PERSIST_DEBOUNCE_MS = 800

/**
 * Auto-restores the previous working session on mount and auto-saves it
 * (debounced) on every change, so a reload or app restart no longer wipes the
 * user's image, settings and manual edits.
 */
export function useSessionPersistence() {
  const snapshot = useAtomValue(captureSessionAtom)
  const restore = useSetAtom(restoreSessionAtom)
  const hydratedRef = useRef(false)

  // Restore once, before we start saving.
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const saved = loadSnapshot()
    if (saved) restore(saved)
  }, [restore])

  // Persist on change, debounced. Skipped until the initial restore has run so
  // we never overwrite a saved session with the empty default state.
  useEffect(() => {
    if (!hydratedRef.current) return
    const handle = setTimeout(
      () => persistSnapshot(snapshot),
      PERSIST_DEBOUNCE_MS
    )
    return () => clearTimeout(handle)
  }, [snapshot])
}
