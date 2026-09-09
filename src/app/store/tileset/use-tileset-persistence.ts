import { useMemo } from 'react'
import { useDebouncedPersistence } from '@/app/store/workshop/use-debounced-persistence'
import {
  idbProjectStore,
  loadTilesetProject,
  saveTilesetProject,
  type TilesetProject,
  type TilesetProjectStore
} from '@/tileset'
import { captureTilesetProjectAtom, restoreTilesetProjectAtom } from './project'

/** A workshop with no sheet in it is not work to keep (Q31). */
const opened = (project: TilesetProject | null) => project !== null

/**
 * Reopens the tileset workshop where the user left it, and saves it as they
 * work (Q31).
 *
 * The store is a parameter so tests can hand a fake one: IndexedDB exists in
 * the browser, not in the test environment.
 */
export function useTilesetPersistence(
  store: TilesetProjectStore = idbProjectStore
) {
  const storage = useMemo(
    () => ({
      load: () => loadTilesetProject(store),
      save: (project: TilesetProject) => saveTilesetProject(store, project)
    }),
    [store]
  )

  useDebouncedPersistence({
    capture: captureTilesetProjectAtom,
    restore: restoreTilesetProjectAtom,
    storage,
    hasContent: opened
  })
}
