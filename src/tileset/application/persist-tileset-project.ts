/**
 * Reading the workshop back, and putting it away (Q31).
 *
 * Persistence is a convenience, never a condition: a store that is missing,
 * blocked or full loses the auto-save, and the workshop opens anyway. The
 * project file is the durable copy the user controls.
 */

import { createLogger } from '@/core'
import type { TilesetProjectStore } from './ports'
import {
  readStoredTilesetProject,
  type TilesetProject
} from './tileset-project'

const tilesetLogger = createLogger({ prefix: '[Tileset]' })

/** The saved project, or `null` when there is none this version can read. */
export async function loadTilesetProject(
  store: TilesetProjectStore
): Promise<TilesetProject | null> {
  try {
    return readStoredTilesetProject(await store.load())
  } catch (error) {
    tilesetLogger.warn('Failed to read the saved project:', error)
    return null
  }
}

/** `false` when the project could not be written — the workshop carries on. */
export async function saveTilesetProject(
  store: TilesetProjectStore,
  project: TilesetProject
): Promise<boolean> {
  try {
    await store.save(project)
    return true
  } catch (error) {
    tilesetLogger.warn('Failed to save the project:', error)
    return false
  }
}
