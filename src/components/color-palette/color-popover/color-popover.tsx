'use client'

import { useRef, useEffect } from 'react'

import { CPCColor } from '@/libs/types'
import { PaletteSlot } from '@/app/store/palette/types'
import { ColorPopoverView } from './color-popover-view'

type ColorPopoverProps = {
  fullPalette: CPCColor[]
  slots: PaletteSlot[]
  slotIdx: number
  focusedColorIdx: number
  onColorSelect: (color: CPCColor, slotIdx: number) => void

  colorOptionRefs?: React.RefObject<(HTMLButtonElement | null)[]>
}

export const ColorPopover: React.FC<ColorPopoverProps> = ({
  fullPalette,
  slots,
  slotIdx,
  focusedColorIdx,
  onColorSelect,

  colorOptionRefs
}) => {
  const optionRefs = useRef<HTMLButtonElement[]>([])
  const initialFocusDone = useRef(false)

  useEffect(() => {
    if (!initialFocusDone.current) {
      const btn = optionRefs.current[focusedColorIdx]
      if (btn) btn.focus()
      initialFocusDone.current = true
    }
  }, [focusedColorIdx])

  return (
    <ColorPopoverView
      fullPalette={fullPalette}
      slots={slots}
      slotIdx={slotIdx}
      focusedColorIdx={focusedColorIdx}
      onColorSelect={onColorSelect}
      colorOptionRefs={
        (colorOptionRefs as React.RefObject<HTMLButtonElement[]>) ??
        (optionRefs as React.RefObject<HTMLButtonElement[]>)
      }
      optionRefs={optionRefs}
    />
  )
}
