/**
 * What the conversion is asked to do (Q15 · Q16 · Q18 · Q23 · Q30).
 *
 * One object rather than a dozen atoms: the shape is `ConvertTilesetInput`
 * minus what the sheet and the grid already carry, so the panels and the
 * use-case cannot drift apart.
 */

import { atom } from 'jotai'
import type { PixelMode } from '@/domain/cpc'
import type { CPCHardware } from '@/libs/types'
import { EMPTY_EDIT_LAYER, type TilesetProjectOptions } from '@/tileset'
import { tilesetEditLayerAtom } from './edit-layer'

/**
 * Declared by the project (`@/tileset`), not here: the panels, the use-case
 * and the saved file must read the same object or a restored project would
 * convert differently from the one that was saved.
 */
export type TilesetOptions = TilesetProjectOptions

/**
 * `transparency` is left out on purpose: the use-case reads it from the mode
 * — a pen in mode 0, flattened in modes 1 and 2, where none can be spared.
 */
export const DEFAULT_TILESET_OPTIONS: TilesetOptions = {
  resize: 'columns',
  paletteStrategy: 'exhaustive-contrast',
  reservedPens: 0,
  dither: 'none',
  ditherSize: 4,
  antiAlias: true
}

export const tilesetModeAtom = atom<PixelMode>(0)

export const tilesetHardwareAtom = atom<CPCHardware>('classic')

export const tilesetOptionsAtom = atom<TilesetOptions>(DEFAULT_TILESET_OPTIONS)

export const setTilesetOptionsAtom = atom(
  null,
  (get, set, payload: Partial<TilesetOptions>) => {
    set(tilesetOptionsAtom, { ...get(tilesetOptionsAtom), ...payload })
  }
)

/**
 * Changing the mode drops the frozen palette: its pens were chosen against a
 * budget the new mode does not have, and edits are stored as pen indices. The
 * edit layer goes with it — pen 5 of mode 0 is not pen 5 of mode 1.
 */
export const setTilesetModeAtom = atom(null, (get, set, payload: PixelMode) => {
  if (get(tilesetModeAtom) === payload) return
  set(tilesetModeAtom, payload)
  const { palette: _dropped, ...kept } = get(tilesetOptionsAtom)
  set(tilesetOptionsAtom, kept)
  set(tilesetEditLayerAtom, EMPTY_EDIT_LAYER)
})
