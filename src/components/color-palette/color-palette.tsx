import { useAtomValue, useSetAtom } from 'jotai'
import type React from 'react'
import { cpcHardwareAtom } from '@/app/store/config/config'
import {
  onClearSlotAtom,
  onSetColorAtom,
  onToggleLockAtom
} from '@/app/store/palette/palette'
import { egxDisplayPaletteAtom } from '@/app/store/preview/egx-preview'
import { displayPaletteAtom } from '@/app/store/preview/preview'
import { activeRenderingPathAtom } from '@/app/store/preview/rendering-path'
import { cpcFullPalette } from '@/domain/cpc'
import { ColorPaletteView } from './color-palette-view'

/**
 * ColorPalette container component.
 *
 * This component connects Jotai atoms/selectors to the presentational ColorPaletteView.
 * It reads the display palette (combining locked slots with reduced palette), provides lock and color change handlers, and passes the full CPC palette.
 * When EGX mode is enabled, it uses the EGX-reordered palette instead.
 *
 * UI and interaction logic are handled in ColorPaletteView.
 *
 * @returns {JSX.Element} The color palette UI.
 */
export const ColorPalette: React.FC = () => {
  // Which rendering path owns the palette on screen
  const renderingPath = useAtomValue(activeRenderingPathAtom)
  // Read the standard display palette
  const standardSlots = useAtomValue(displayPaletteAtom)
  // Read the EGX display palette (reordered for high-res lines)
  const egxSlots = useAtomValue(egxDisplayPaletteAtom)
  // The EGX path publishes its own slots; every other path falls back to the
  // standard ones (so does EGX itself until its palette is ready).
  const slots =
    renderingPath === 'egx' && egxSlots.length > 0 ? egxSlots : standardSlots
  // Handler to toggle lock state for a slot
  const toggleLock = useSetAtom(onToggleLockAtom)
  // Handler to set a color for a slot
  const setColor = useSetAtom(onSetColorAtom)
  // Handler to clear a slot and lock it
  const clearSlot = useSetAtom(onClearSlotAtom)

  // Get the full CPC palette for color selection
  const fullPalette = cpcFullPalette
  const hardware = useAtomValue(cpcHardwareAtom)

  return (
    <ColorPaletteView
      slots={slots}
      onToggleLock={toggleLock}
      onSetColor={setColor}
      onClearSlot={clearSlot}
      fullPalette={fullPalette}
      hardware={hardware}
    />
  )
}
