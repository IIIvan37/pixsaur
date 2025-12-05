import { useAtomValue } from 'jotai'
import { cpcHardwareAtom } from '@/app/store/config/config'
import type { PaletteSlot } from '@/app/store/palette/types'
import { ColorPickerPopup } from '@/components/ui/color-picker-popup'
import Icon from '@/components/ui/icon'
import PixsaurPopover from '@/components/ui/popover'
import type { Vector } from '@/libs/pixsaur-color/src/type'
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
  readonly onRgbColorSelect?: (color: Vector, idx: number) => void
  readonly colorOptionRefs: React.RefObject<(HTMLButtonElement | null)[]>
  readonly locked: boolean
  readonly onToggleLock: (idx: number) => void
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
  onRgbColorSelect,
  colorOptionRefs,
  locked,
  onToggleLock
}: EmptySlotButtonProps) {
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const isPlus = cpcHardware === 'plus'

  const handleRgbChange = (color: Vector) => {
    if (onRgbColorSelect) {
      onRgbColorSelect(color, idx)
    }
  }

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleLock(idx)
  }

  // If locked and empty, show a locked empty slot with toggle button
  if (locked) {
    return (
      <div className={styles.emptySlotContainer}>
        <button
          ref={buttonRef}
          className={styles.emptySlot}
          aria-label='Slot vide verrouillé'
          type='button'
          onClick={handleToggleLock}
        >
          <Icon name='LockClosedIcon' className={styles.lockIconEmpty} />
        </button>
      </div>
    )
  }

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
      variant={isPlus ? 'unstyled' : 'default'}
    >
      {isPlus ? (
        <ColorPickerPopup
          initialColor={[128, 128, 128]} // Valeur par défaut (gris moyen)
          isLocked={false}
          onColorConfirm={handleRgbChange}
          onToggleLock={() => {}} // Pas de verrouillage pour les slots vides
          onClearSlot={() => {}} // Pas d'action vider pour les slots vides
          onClose={() => onOpenChange(false)}
        />
      ) : (
        <ColorGrid
          fullPalette={fullPalette}
          slots={slots}
          slotIndex={idx}
          focusedColorIndex={focusedColorIdx}
          onColorSelect={onColorSelect}
          colorOptionRefs={colorOptionRefs}
        />
      )}
    </PixsaurPopover>
  )
}
