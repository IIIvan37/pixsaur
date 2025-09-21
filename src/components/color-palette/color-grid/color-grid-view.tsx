import clsx from 'clsx'
import type * as React from 'react'
import type { PaletteSlot } from '@/app/store/palette/types'
import Button from '@/components/ui/button'
import type { CPCColor } from '@/libs/types'
import { ColorButton } from '../color-slot/color-button'
import styles from './color-grid.module.css'

export type ColorGridViewProps = {
  readonly fullPalette: CPCColor[]
  readonly slots: PaletteSlot[]
  readonly slotIndex: number
  readonly focusedColorIndex: number
  readonly onColorSelect: (color: CPCColor, slotIndex: number) => void
  readonly onToggleLock: (index: number) => void
  readonly colorOptionRefs: React.RefObject<(HTMLButtonElement | null)[]>
  readonly optionRefs: React.RefObject<(HTMLButtonElement | null)[]>
  readonly onClose: () => void
}

export function ColorGridView({
  fullPalette,
  slots,
  slotIndex,
  focusedColorIndex,
  onColorSelect,
  onToggleLock,
  colorOptionRefs,
  optionRefs,
  onClose
}: ColorGridViewProps) {
  // Helper to check if a color is used in the palette (excluding current slot)
  const isColorUsed = (s: PaletteSlot, pc: CPCColor, index: number) => {
    return (
      s.color &&
      index !== slotIndex &&
      Array.from(s.color).every((v, j) => v === pc.vector[j])
    )
  }
  const slot = slots[slotIndex]
  return (
    <div
      className='popover'
      style={{ position: 'relative', minHeight: 140, maxHeight: 260 }}
    >
      {/* @sonar-ignore-next-line a11y/useSemanticElements: Custom color grid requires visual display - select not suitable */}
      <div
        className={styles.colorGrid}
        aria-label='Options de couleur'
      >
        {fullPalette.map((pc: CPCColor, optionIndex: number) => {
          const isUsed = slots.some((s: PaletteSlot, i: number) =>
            isColorUsed(s, pc, i)
          )
          return (
            <div key={pc.hex}>
              {/* @sonar-ignore-next-line a11y/useSemanticElements: Custom color option with visual display */}
              <ColorButton
                colorHex={`#${pc.hex}`}
                className={clsx(
                  styles.colorOption,
                  isUsed && styles.colorOptionUsed
                )}
                title={`${pc.name}${isUsed ? ' (utilisée)' : ''}`}
                aria-selected={focusedColorIndex === optionIndex}
                disabled={isUsed}
                tabIndex={focusedColorIndex === optionIndex ? 0 : -1}
                buttonRef={(el: HTMLButtonElement | null) => {
                  if (colorOptionRefs?.current)
                    colorOptionRefs.current[optionIndex] = el
                  if (optionRefs?.current) optionRefs.current[optionIndex] = el
                }}
                onClick={() => onColorSelect(pc, slotIndex)}
              />
            </div>
          )
        })}
      </div>
      {/* Affiche le bouton lock uniquement si le slot est rempli */}
      {slot.color && (
        <Button
          className={styles.lockButton}
          variant='secondary'
          onClick={() => {
            onToggleLock(slotIndex)
            onClose()
          }}
        >
          {slot.locked ? 'Déverrouiller' : 'Verrouiller'}
        </Button>
      )}
    </div>
  )
}
