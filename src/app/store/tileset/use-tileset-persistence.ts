import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import {
  idbProjectStore,
  loadTilesetProject,
  saveTilesetProject,
  type TilesetProjectStore
} from '@/tileset'
import { captureTilesetProjectAtom, restoreTilesetProjectAtom } from './project'

/** Debounce window before a changed project is written back to storage. */
const PERSIST_DEBOUNCE_MS = 800

/**
 * Reopens the workshop where the user left it, and saves it as they work
 * (Q31).
 *
 * The store is a parameter so tests can hand a fake one: IndexedDB exists in
 * the browser, not in the test environment.
 */
export function useTilesetPersistence(
  store: TilesetProjectStore = idbProjectStore
) {
  const project = useAtomValue(captureTilesetProjectAtom)
  const restore = useSetAtom(restoreTilesetProjectAtom)
  const [hydrated, setHydrated] = useState(false)

  // The saved project is read asynchronously; by the time it lands the user
  // may already have dropped a sheet in. Theirs wins — it is the one they can
  // see.
  const projectRef = useRef(project)
  projectRef.current = project

  useEffect(() => {
    let cancelled = false
    loadTilesetProject(store).then((saved) => {
      if (cancelled) return
      if (saved && !projectRef.current) restore(saved)
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [restore, store])

  // Saved on change, debounced. Held back until the restore has run, so the
  // empty workshop never overwrites the saved project.
  useEffect(() => {
    if (!hydrated || !project) return
    const handle = setTimeout(() => {
      void saveTilesetProject(store, project)
    }, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [hydrated, project, store])
}
