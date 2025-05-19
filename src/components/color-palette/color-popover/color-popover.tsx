import { PaletteSlot } from '@/app/store/palette/types'
import styles from '../color-palette.module.css'
import animStyles from '@/styles/animations.module.css'
import { CPCColor } from '@/libs/types'
import { Popover } from '@/components/ui/popover'
import { useRef, useEffect } from 'react'

type ColorPopoverProps = {
  fullPalette: CPCColor[]
  slots: PaletteSlot[]
  slotIdx: number
  focusedColorIdx: number
  onColorSelect: (color: CPCColor, slotIdx: number) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  getPopoverStyle: (idx: number) => React.CSSProperties
  onClose: () => void
  colorOptionRefs?: React.RefObject<(HTMLButtonElement | null)[]>
}

export const ColorPopover: React.FC<ColorPopoverProps> = ({
  fullPalette,
  slots,
  slotIdx,
  focusedColorIdx,
  onColorSelect,
  onKeyDown,
  getPopoverStyle,
  onClose,
  colorOptionRefs
}) => {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    // Wait for refs to be set after render
    const btn = optionRefs.current[focusedColorIdx]
    if (btn) {
      // Use setTimeout to ensure focus after DOM update
      setTimeout(() => btn.focus(), 0)
    }
  }, [focusedColorIdx, fullPalette.length])

  return (
    <Popover
      isOpen={true}
      getPopoverStyle={() => getPopoverStyle(slotIdx)}
      onKeyDown={onKeyDown}
      onClose={onClose}
    >
      <div
        className={styles.colorGrid}
        role='listbox'
        aria-label='Options de couleur'
      >
        {fullPalette.map((pc, optionIdx) => {
          const isUsed = slots.some((s, i) => {
            if (i === slotIdx) return false
            if (!s.color) return false
            return Array.from(s.color).every((v, j) => v === pc.vector[j])
          })

          return (
            <button
              ref={(el) => {
                if (colorOptionRefs) colorOptionRefs.current[optionIdx] = el
              }}
              key={pc.index}
              className={`${styles.colorOption} ${animStyles.colorSquare} ${
                isUsed ? styles.colorOptionActive : ''
              }`}
              style={{ backgroundColor: `#${pc.hex}` }}
              title={`${pc.name}${isUsed ? ' (utilisée)' : ''}`}
              role='option'
              aria-selected={isUsed}
              disabled={isUsed}
              tabIndex={focusedColorIdx === optionIdx ? 0 : -1}
              onClick={() => onColorSelect(pc, slotIdx)}
            />
          )
        })}
      </div>
    </Popover>
  )
}
