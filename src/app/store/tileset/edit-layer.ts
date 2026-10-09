/**
 * The edit layer itself (Q19 · Q31).
 *
 * A leaf module on purpose: the sheet, the grid, the target size and the mode
 * all drop the layer when they move, and none of them can import the atoms
 * that read them back without closing a cycle.
 */

import { atom } from 'jotai'
import { EMPTY_EDIT_LAYER, type TilesetEditLayer } from '@/tileset'

/**
 * The strokes made so far and how far along the undo cursor stands.
 *
 * Dropped whenever the geometry moves — a stroke is a pixel of a tile at a
 * position, and a new grid or a new destination size makes both of those mean
 * something else. The palette freeze of Q28 is what protects the layer from
 * the settings that do NOT move it.
 */
export const tilesetEditLayerAtom = atom<TilesetEditLayer>(EMPTY_EDIT_LAYER)

/**
 * The tile the retouching panel is aimed at, by position in the sheet, or
 * `null` while the user has not picked one (S-Q11).
 *
 * A position and not a unique tile: a click on the map or the sheet names a
 * position, and the retouch reaches every position of the same tile. Here,
 * beside the layer, because a new sheet drops both.
 */
export const selectedTileAtom = atom<number | null>(null)
