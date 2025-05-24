import { PaletteSlot } from '@/app/store/palette/types'
import { CPCColor } from '@/libs/types'
import styles from './color-grid.module.css'
import animStyles from '@/styles/animations.module.css'
import { ColorButton } from '../color-slot/color-button'
import clsx from 'clsx'

export type ColorGridViewProps = {
  fullPalette: CPCColor[]
  slots: PaletteSlot[]
  slotIdx: number
  focusedColorIdx: number
  onColorSelect: (color: CPCColor, slotIdx: number) => void
  colorOptionRefs: React.RefObject<HTMLButtonElement[]>
  optionRefs: React.RefObject<HTMLButtonElement[]>
}

export function ColorGridView({
  fullPalette,
  slots,
  slotIdx,
  focusedColorIdx,
  onColorSelect,
  colorOptionRefs,
  optionRefs
}: ColorGridViewProps) {
  return (
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
          <div key={optionIdx}>
            <ColorButton
              colorHex={`#${pc.hex}`}
              className={clsx(
                styles.colorOption,
                isUsed && styles.colorOptionUsed
              )}
              title={`${pc.name}${isUsed ? ' (utilisée)' : ''}`}
              role='option'
              ariaSelected={focusedColorIdx === optionIdx}
              disabled={isUsed}
              tabIndex={focusedColorIdx === optionIdx ? 0 : -1}
              buttonRef={(el) => {
                if (colorOptionRefs && el)
                  colorOptionRefs.current[optionIdx] = el
                if (el) optionRefs.current[optionIdx] = el
              }}
              onClick={() => onColorSelect(pc, slotIdx)}
            />
          </div>
        )
      })}
    </div>
  )
}
