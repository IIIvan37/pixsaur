import { PaletteSlot } from '@/app/store/palette/types'
import styles from '../color-palette.module.css'
import animStyles from '@/styles/animations.module.css'
import { CPCColor } from '@/libs/types'
import { Popover } from '@/components/ui/popover/popover'
import Icon from '@/components/ui/icon'
type ColorPopoverProps = {
  fullPalette: CPCColor[]
  slots: PaletteSlot[]
  slotIdx: number
  focusedColorIdx: number
  onColorSelect: (color: CPCColor, slotIdx: number) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  getPopoverStyle: (idx: number) => React.CSSProperties
  onClose: () => void
}

export const ColorPopover: React.FC<ColorPopoverProps> = ({
  fullPalette,
  slots,
  slotIdx,
  focusedColorIdx,
  onColorSelect,
  onKeyDown,
  getPopoverStyle,
  onClose
}) => (
  <Popover
    isOpen={true}
    getPopoverStyle={() => getPopoverStyle(slotIdx)}
    onKeyDown={onKeyDown}
    onClose={onClose}
    trigger={
      <button className={styles.emptySlot} aria-label='Ajouter une couleur'>
        <Icon name='PlusIcon' className={styles.plusIcon} />
      </button>
    }
  >
    <div
      className={styles.colorGrid}
      role='listbox'
      aria-label='Options de couleur'
    >
      {fullPalette.map((pc, optionIdx) => {
        const isUsed = slots.some((s, i) => {
          if (i === slotIdx) return false
          return (
            Array.from(s.color ?? []).every((v, j) => v === pc.vector[j]) ??
            false
          )
        })
        return (
          <button
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
            autoFocus={focusedColorIdx === optionIdx}
            onClick={() => onColorSelect(pc, slotIdx)}
          />
        )
      })}
    </div>
  </Popover>
)
