import {
  userPaletteAtom,
  onToggleLockAtom,
  onSetColorAtom
} from '@/app/store/palette/palette'

import { ColorPaletteView } from './color-palette-view'
import { getCPCPalette } from '@/libs/cpc-palette'
import { useAtomValue, useSetAtom } from 'jotai'
import React from 'react'

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

  // Full CPC palette for color lookup
  const fullPalette = getCPCPalette()

  return (
    <ColorPaletteView
      slots={slots}
      onToggleLock={toggleLock}
      onSetColor={setColor}
      fullPalette={fullPalette}
    />
  )
}
