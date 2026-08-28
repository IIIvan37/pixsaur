/**
 * The palette the conversion produced, editable pen by pen (Q15 · Q28).
 *
 * The same grid as the image workshop's — `ColorPaletteView` is shared — over
 * the tileset's own atoms and its own machine. What differs is what a lock
 * means: here a pinned pen is a colour AT an index, which the strategy must
 * return and put back there, because a retouch is stored as a pen index.
 *
 * No `onClearSlot`: the conversion fills every pen it declares, so a slot is
 * never empty. Pens are left free by the count in the Palette tab, not here.
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  setTilesetPenAtom,
  tilesetHardwareAtom,
  tilesetPaletteSlotsAtom,
  toggleTilesetPenLockAtom
} from '@/app/store/tileset/tileset'
import { ColorPaletteView } from '@/components/color-palette/color-palette-view'
import { cpcFullPalette } from '@/domain/cpc'

export function TilesetColorPalette() {
  const { _ } = useLingui()
  const slots = useAtomValue(tilesetPaletteSlotsAtom)
  const hardware = useAtomValue(tilesetHardwareAtom)
  const setPen = useSetAtom(setTilesetPenAtom)
  const toggleLock = useSetAtom(toggleTilesetPenLockAtom)

  if (slots.length === 0) return null

  return (
    <ColorPaletteView
      slots={slots}
      fullPalette={cpcFullPalette}
      hardware={hardware}
      label={_(msg`Palette du tileset`)}
      onToggleLock={toggleLock}
      onSetColor={({ index, color }) => setPen({ index, color: color.vector })}
    />
  )
}
