/**
 * Reopens a workshop where the user left it, and saves it as they work.
 *
 * One mechanism for both workshops: read the saved state once on mount, put it
 * back only if the screen is empty, then write every later change back after a
 * pause. The state itself is not shared — each workshop keeps its own atom
 * space (Q6 · Q32 · Q34) and hands its own capture, restore and storage in.
 *
 * The storage is a parameter, not an import: IndexedDB and `localStorage`
 * exist in the browser, not in the test environment.
 */

import { type Atom, useAtomValue, useSetAtom, type WritableAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'

/** Debounce window before a changed workshop is written back to storage. */
const PERSIST_DEBOUNCE_MS = 800

/** Where a workshop remembers itself; either half may answer synchronously. */
export interface WorkshopStorage<T> {
  /** `null` when nothing was ever saved. */
  load: () => Promise<T | null> | T | null
  save: (state: T) => unknown
}

export interface DebouncedPersistence<T> {
  /** What the workshop looks like right now; `null` when it is empty. */
  capture: Atom<T | null>
  /** Puts a saved state back into the atom space. */
  restore: WritableAtom<any, [T], any>
  storage: WorkshopStorage<T>
  /**
   * Whether a workshop the user has already filled must survive the restore.
   * A workshop whose capture is never `null` — the image session, which always
   * has settings to report — leaves it off and takes back what was saved.
   */
  keepLiveState?: boolean
}

export function useDebouncedPersistence<T>({
  capture,
  restore,
  storage,
  keepLiveState
}: DebouncedPersistence<T>): void {
  const state = useAtomValue(capture)
  const put = useSetAtom(restore)
  const [hydrated, setHydrated] = useState(false)

  // The saved state is read asynchronously; by the time it lands the user may
  // already have dropped something in. Theirs wins — it is what they can see.
  const stateRef = useRef(state)
  stateRef.current = state

  // Neither is a reason to read storage again: the load runs once, on mount.
  const storageRef = useRef(storage)
  storageRef.current = storage
  const keepRef = useRef(keepLiveState)
  keepRef.current = keepLiveState

  useEffect(() => {
    let cancelled = false
    void Promise.resolve(storageRef.current.load()).then((saved) => {
      if (cancelled) return
      const theirs = keepRef.current && stateRef.current !== null
      if (saved !== null && !theirs) put(saved)
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [put])

  // Saved on change, debounced. Held back until the restore has run, so the
  // empty workshop never overwrites what was saved.
  useEffect(() => {
    if (!hydrated || state === null) return
    const handle = setTimeout(() => {
      void storageRef.current.save(state)
    }, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [hydrated, state])
}
