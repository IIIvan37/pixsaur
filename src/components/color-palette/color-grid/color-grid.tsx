import { useRef, useEffect } from 'react'

import { CPCColor } from '@/libs/types'
import { PaletteSlot } from '@/app/store/palette/types'
import { ColorGridView } from './color-grid-view'

type ColorGridProps = {
  fullPalette: CPCColor[]
  slots: PaletteSlot[]
  slotIndex: number
  focusedColorIndex: number
  onColorSelect: (color: CPCColor, slotIndex: number) => void
  colorOptionRefs?: React.RefObject<(HTMLButtonElement | null)[]>
}

export const ColorGrid: React.FC<ColorGridProps> = ({
  fullPalette,
  slots,
  slotIndex,
  focusedColorIndex,
  onColorSelect,
  colorOptionRefs
}) => {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const initialFocusDone = useRef(false)

  useEffect(() => {
    if (!initialFocusDone.current) {
      const btn = optionRefs.current[focusedColorIndex]
      if (btn) btn.focus()
      initialFocusDone.current = true
    }
  }, [focusedColorIndex])

  // Placeholder handlers for unimplemented methods
  // Placeholder functions for unimplemented handlers (camelCase)
  const handleToggleLock = (): void => {
    throw new Error('Function not implemented.');
  };
  const handleClose = (): void => {
    throw new Error('Function not implemented.');
  };

  return (
    <ColorGridView
      fullPalette={fullPalette}
      slots={slots}
      slotIndex={slotIndex}
      focusedColorIndex={focusedColorIndex}
      onColorSelect={onColorSelect}
      colorOptionRefs={colorOptionRefs ?? optionRefs}
      optionRefs={optionRefs}
      onToggleLock={handleToggleLock}
      onClose={handleClose}
    />
  )
}
