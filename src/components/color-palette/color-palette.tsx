import { useAtomValue, useSetAtom } from 'jotai'
import type React from 'react'
import { cpcHardwareAtom } from '@/app/store/config/config'
import {
  onSetColorAtom,
  onToggleLockAtom,
  userPaletteAtom
} from '@/app/store/palette/palette'
import { getCPCPaletteByHardware } from '@/palettes/cpc-palette'
import { ColorPaletteView } from './color-palette-view'

/**
 * ColorPalette container component.
 *
 * This component connects Jotai atoms/selectors to the presentational ColorPaletteView.
 * It reads the user's palette, provides lock and color change handlers, and passes the full CPC palette.
 *
 * UI and interaction logic are handled in ColorPaletteView.
 *
 * @returns {JSX.Element} The color palette UI.
 */
export const ColorPalette: React.FC = () => {
  // Read the merged palette (reduced + locked) from state
  const slots = useAtomValue(userPaletteAtom)
  // Handler to toggle lock state for a slot
  const toggleLock = useSetAtom(onToggleLockAtom)
  // Handler to set a color for a slot
  const setColor = useSetAtom(onSetColorAtom)

  // Get CPC hardware mode and corresponding palette
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const fullPalette = getCPCPaletteByHardware(cpcHardware)

  return (
    <ColorPaletteView
      slots={slots}
      onToggleLock={toggleLock}
      onSetColor={setColor}
      fullPalette={fullPalette}
    />
  )
}
