/**
 * The workshop's document, read out and put back (Q31).
 *
 * `captureTilesetProjectAtom` reads the leaf atoms into a {@link TilesetProject};
 * `restoreTilesetProjectAtom` writes one back. The plumbing to IndexedDB lives
 * in `use-tileset-persistence.ts`, the file export in the project panel.
 */

import { atom } from 'jotai'
import { TILESET_PROJECT_VERSION, type TilesetProject } from '@/tileset'
import {
  tilesetHardwareAtom,
  tilesetModeAtom,
  tilesetOptionsAtom
} from './config'
import { tilesetEditLayerAtom } from './edit-layer'
import { sourcePlatformAtom, tilesetTargetAtom } from './geometry'
import { tilesetGridAtom } from './grid'
import { tilesetSheetAtom } from './sheet'

/** `null` until a sheet is imported: there is no document to save before. */
export const captureTilesetProjectAtom = atom<TilesetProject | null>((get) => {
  const sheet = get(tilesetSheetAtom)
  if (!sheet) return null

  return {
    version: TILESET_PROJECT_VERSION,
    sheet,
    source: get(tilesetGridAtom),
    target: get(tilesetTargetAtom),
    mode: get(tilesetModeAtom),
    hardware: get(tilesetHardwareAtom),
    sourcePlatform: get(sourcePlatformAtom),
    options: get(tilesetOptionsAtom),
    edits: get(tilesetEditLayerAtom)
  }
})

/**
 * Apply a project to the live atoms.
 *
 * Written on the leaf atoms, never through the setters: those drop the edit
 * layer when the geometry moves and the palette when the mode does — which is
 * right for a user changing their mind, and wrong for a document being put
 * back exactly as it was left. The edit layer goes last all the same, so a
 * setter added later cannot silently erase what was just restored.
 */
export const restoreTilesetProjectAtom = atom(
  null,
  (_get, set, project: TilesetProject) => {
    set(tilesetSheetAtom, project.sheet)
    set(tilesetGridAtom, project.source)
    set(tilesetTargetAtom, project.target)
    set(tilesetModeAtom, project.mode)
    set(tilesetHardwareAtom, project.hardware)
    set(sourcePlatformAtom, project.sourcePlatform)
    set(tilesetOptionsAtom, project.options)
    set(tilesetEditLayerAtom, project.edits)
  }
)
