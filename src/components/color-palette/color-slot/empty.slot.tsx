import Icon from '@/components/ui/icon'
import styles from './color-slot.module.css'
import PixsaurPopover from '@/components/ui/popover'
import { PaletteSlot } from '@/app/store/palette/types'
import { CPCColor } from '@/libs/types'
import { ColorGrid } from '../color-grid'

export type EmptySlotButtonProps = {
  idx: number
  buttonRef: (el: HTMLButtonElement | null) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  slots: PaletteSlot[]
  fullPalette: CPCColor[]
  focusedColorIdx: number
  onColorSelect: (color: CPCColor, idx: number) => void
  colorOptionRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>
}

export function EmptySlotButton({
  open,
  onOpenChange,
  buttonRef,
  idx,
  slots,
  fullPalette,
  focusedColorIdx,
  onColorSelect,
  colorOptionRefs
}: EmptySlotButtonProps) {
  return (
    <PixsaurPopover
      trigger={
        <button
          ref={buttonRef}
          className={styles.emptySlot}
          aria-label='Ajouter une couleur'
        >
          <Icon name='PlusIcon' className={styles.plusIcon} />
        </button>
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <ColorGrid
        fullPalette={fullPalette}
        slots={slots}
        slotIdx={idx}
        focusedColorIdx={focusedColorIdx}
        onColorSelect={onColorSelect}
        colorOptionRefs={colorOptionRefs}
      />
    </PixsaurPopover>
  )
}
