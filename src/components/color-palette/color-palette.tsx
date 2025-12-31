import { useAtomValue, useSetAtom } from 'jotai'
import type React from 'react'
import { egxEnabledAtom } from '@/app/store/config/config'
import {
  onClearSlotAtom,
  onSetColorAtom,
  onToggleLockAtom
} from '@/app/store/palette/palette'
import { egxDisplayPaletteAtom } from '@/app/store/preview/egx-preview'
import { displayPaletteAtom } from '@/app/store/preview/preview'
import { cpcFullPalette } from '@/palettes/cpc-palette'
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
  // Check if EGX mode is enabled
  const egxEnabled = useAtomValue(egxEnabledAtom)
  // Read the standard display palette
  const standardSlots = useAtomValue(displayPaletteAtom)
  // Read the EGX display palette (reordered for high-res lines)
  const egxSlots = useAtomValue(egxDisplayPaletteAtom)
  // Use EGX palette when EGX is enabled and palette is available
  const slots = egxEnabled && egxSlots.length > 0 ? egxSlots : standardSlots
  // Handler to toggle lock state for a slot
  const toggleLock = useSetAtom(onToggleLockAtom)
  // Handler to set a color for a slot
  const setColor = useSetAtom(onSetColorAtom)
  // Handler to clear a slot and lock it
  const clearSlot = useSetAtom(onClearSlotAtom)

  // Get the full CPC palette for color selection
  const fullPalette = cpcFullPalette

  return (
    <ColorPaletteView
      slots={slots}
      onToggleLock={toggleLock}
      onSetColor={setColor}
      onClearSlot={clearSlot}
      fullPalette={fullPalette}
    />
  )
}
