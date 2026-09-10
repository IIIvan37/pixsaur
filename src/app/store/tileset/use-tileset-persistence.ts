import { useDebouncedPersistence } from '@/app/store/workshop/use-debounced-persistence'
import {
  idbProjectStore,
  loadTilesetProject,
  saveTilesetProject,
  type TilesetProject,
  type TilesetProjectStore
} from '@/tileset'
import { captureTilesetProjectAtom, restoreTilesetProjectAtom } from './project'

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
  useDebouncedPersistence({
    capture: captureTilesetProjectAtom,
    restore: restoreTilesetProjectAtom,
    storage: {
      load: () => loadTilesetProject(store),
      save: (project: TilesetProject) => saveTilesetProject(store, project)
    },
    // A sheet the user imported before the load landed is not overwritten.
    keepLiveState: true
  })
}
