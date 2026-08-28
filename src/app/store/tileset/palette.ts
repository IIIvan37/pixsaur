/**
 * The palette as the user may pin it (Q15 · Q28).
 *
 * What the panel shows is the palette the conversion produced; what it writes
 * is `lockedPens`, which the next conversion honours. A pin carries its INDEX,
 * not just its colour: a retouch is stored as a pen index (Q19), so a pin that
 * let the pens around it move would repaint every stroke already laid.
 *
 * Three writes, three destinations, because three things are being said:
 * the hole's colour is the background, a frozen palette IS the palette, and
 * anything else is a pin.
 */

import { atom, type Getter } from 'jotai'
import type { PaletteSlot } from '@/app/store/palette/types'
import { CPC_MODE_CONFIG, type CpcModeKey } from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { Pen } from '@/tileset'
import { tilesetModeAtom, tilesetOptionsAtom } from './config'
import { convertedTilesetAtom } from './conversion'

/** How many pens the mode holds — 16, 4 or 2 — whatever the sheet needed. */
function penCount(get: Getter): number {
  return CPC_MODE_CONFIG[`${get(tilesetModeAtom)}` as CpcModeKey].nColors
}

/** How many of them the tileset may spend: the rest are reserved (Q23). */
function penBudget(get: Getter): number {
  return penCount(get) - (get(tilesetOptionsAtom).reservedPens ?? 0)
}

/**
 * The palette on screen: one slot per pen the MODE holds, not per pen the
 * conversion happened to need. A sheet of five colours in mode 0 still shows
 * sixteen — the eleven empty ones are where a colour can be pinned, which is
 * the whole point of the grid.
 */
export const tilesetPaletteSlotsAtom = atom<PaletteSlot[]>((get) => {
  const result = get(convertedTilesetAtom)
  if (!result?.ok) return []

  const { palette, transparentPen } = result.tileset
  const pinned = get(tilesetOptionsAtom).lockedPens ?? {}
  const budget = penBudget(get)

  return Array.from({ length: penCount(get) }, (_unused, index) => ({
    color: (palette[index] ?? null) as Vector<'RGB'> | null,
    // Three ways a slot is not the user's to move: the hole is fixed by the
    // transparency setting, a reserved pen was promised to the sprites, and a
    // pinned one is locked because that is what pinning means.
    locked:
      index === transparentPen || index >= budget || pinned[index] !== undefined
  }))
})

/** Whether that pen is the hole, whose colour is the background, not a pin. */
function isHole(get: Getter, index: number): boolean {
  const result = get(convertedTilesetAtom)
  return result?.ok === true && result.tileset.transparentPen === index
}

export interface SetTilesetPenPayload {
  index: number
  color: Vector<'RGB'>
}

export const setTilesetPenAtom = atom(
  null,
  (get, set, { index, color }: SetTilesetPenPayload) => {
    const options = get(tilesetOptionsAtom)

    // A reserved pen belongs to the sprites, not to the tileset: the use-case
    // would refuse the pin, so the panel does not make it.
    if (index >= penBudget(get)) return

    if (isHole(get, index)) {
      set(tilesetOptionsAtom, { ...options, background: color as Pen })
      return
    }

    if (options.palette) {
      const palette = [...options.palette]
      palette[index] = color as Pen
      set(tilesetOptionsAtom, { ...options, palette })
      return
    }

    set(tilesetOptionsAtom, {
      ...options,
      lockedPens: { ...options.lockedPens, [index]: color as Pen }
    })
  }
)

/** Pins the pen the conversion gave that index, or hands it back. */
export const toggleTilesetPenLockAtom = atom(
  null,
  (get, set, index: number) => {
    if (isHole(get, index) || index >= penBudget(get)) return

    const options = get(tilesetOptionsAtom)
    const pinned = options.lockedPens ?? {}

    if (pinned[index] !== undefined) {
      const { [index]: _freed, ...kept } = pinned
      set(tilesetOptionsAtom, { ...options, lockedPens: kept })
      return
    }

    const result = get(convertedTilesetAtom)
    const pen = result?.ok ? result.tileset.palette[index] : undefined
    if (!pen) return

    set(tilesetOptionsAtom, {
      ...options,
      lockedPens: { ...pinned, [index]: pen }
    })
  }
)
