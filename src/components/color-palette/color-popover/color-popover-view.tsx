import { PaletteSlot } from '@/app/store/palette/types'
import { CPCColor } from '@/libs/types'
import styles from '../color-palette.module.css'
import animStyles from '@/styles/animations.module.css'

export type ColorPopoverViewProps = {
  fullPalette: CPCColor[]
  slots: PaletteSlot[]
  slotIdx: number
  focusedColorIdx: number
  onColorSelect: (color: CPCColor, slotIdx: number) => void
  colorOptionRefs: React.RefObject<HTMLButtonElement[]>
  optionRefs: React.RefObject<HTMLButtonElement[]>
}

export function ColorPopoverView({
  fullPalette,
  slots,
  slotIdx,
  focusedColorIdx,
  onColorSelect,
  colorOptionRefs,
  optionRefs
}: ColorPopoverViewProps) {
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
          <button
            ref={(el) => {
              if (colorOptionRefs && el) colorOptionRefs.current[optionIdx] = el
              if (el) optionRefs.current[optionIdx] = el
            }}
            key={pc.index}
            className={`${styles.colorOption} ${animStyles.colorSquare} ${
              isUsed ? styles.colorOptionActive : ''
            }`}
            style={{ backgroundColor: `#${pc.hex}` }}
            title={`${pc.name}${isUsed ? ' (utilisée)' : ''}`}
            role='option'
            aria-selected={focusedColorIdx === optionIdx}
            disabled={isUsed}
            tabIndex={focusedColorIdx === optionIdx ? 0 : -1}
            onClick={() => onColorSelect(pc, slotIdx)}
          />
        )
      })}
    </div>
  )
}
