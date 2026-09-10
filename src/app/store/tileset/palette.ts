/**
 * The palette as the user may pin it (Q15 · Q28).
 *
 * What the panel shows is the palette the conversion produced; what it writes
 * is `lockedPens`, which the next conversion honours. A pin carries its INDEX,
 * not just its colour: a retouch is stored as a pen index (Q19), so a pin that
 * let the pens around it move would repaint every stroke already laid.
 *
 * Which slot the user owns and where a dropped colour goes are decided in
 * `@/tileset` — the same rules the conversion applies. These atoms read and
 * write, nothing more: a refusal comes back as the options unchanged, which
 * Jotai turns into a no-op on its own.
 */

import { atom, type Getter } from 'jotai'
import type { PaletteSlot } from '@/app/store/palette/types'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  type ConvertedPalette,
  dropPen,
  type Pen,
  tilesetPaletteSlots,
  togglePenLock
} from '@/tileset'
import { tilesetModeAtom, tilesetOptionsAtom } from './config'
import { convertedTilesetAtom } from './conversion'

/** The palette the last conversion chose, or `null` while there is none. */
function producedPalette(get: Getter): ConvertedPalette | null {
  const result = get(convertedTilesetAtom)
  return result?.ok ? result.tileset : null
}

export const tilesetPaletteSlotsAtom = atom<PaletteSlot[]>((get) =>
  tilesetPaletteSlots({
    mode: get(tilesetModeAtom),
    options: get(tilesetOptionsAtom),
    produced: producedPalette(get)
  })
)

export interface SetTilesetPenPayload {
  index: number
  color: Vector<'RGB'>
}

export const setTilesetPenAtom = atom(
  null,
  (get, set, { index, color }: SetTilesetPenPayload) => {
    set(
      tilesetOptionsAtom,
      dropPen({
        mode: get(tilesetModeAtom),
        options: get(tilesetOptionsAtom),
        index,
        color: color as Pen
      })
    )
  }
)

export const toggleTilesetPenLockAtom = atom(
  null,
  (get, set, index: number) => {
    set(
      tilesetOptionsAtom,
      togglePenLock({
        mode: get(tilesetModeAtom),
        options: get(tilesetOptionsAtom),
        produced: producedPalette(get),
        index
      })
    )
  }
)
