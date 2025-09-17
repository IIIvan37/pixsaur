import type { PaletteSlot } from '@/app/store/palette/types'
import Icon from '@/components/ui/icon'
import PixsaurPopover from '@/components/ui/popover'
import type { CPCColor } from '@/libs/types'
import { ColorGrid } from '../color-grid'
import styles from './color-slot.module.css'

export type EmptySlotButtonProps = {
  readonly idx: number
  readonly buttonRef: (el: HTMLButtonElement | null) => void
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly slots: PaletteSlot[]
  readonly fullPalette: CPCColor[]
  readonly focusedColorIdx: number
  readonly onColorSelect: (color: CPCColor, idx: number) => void
  readonly colorOptionRefs: React.RefObject<(HTMLButtonElement | null)[]>
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
          type='button'
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
        slotIndex={idx}
        focusedColorIndex={focusedColorIdx}
        onColorSelect={onColorSelect}
        colorOptionRefs={colorOptionRefs}
      />
    </PixsaurPopover>
  )
}
