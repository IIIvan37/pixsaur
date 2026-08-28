import { Trans } from '@lingui/react/macro'
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
  /** Omit where a slot is never empty — the button is then not offered. */
  readonly onClearSlot?: (index: number) => void
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
  onClearSlot,
  colorOptionRefs,
  optionRefs,
  onClose
}: ColorGridViewProps) {
  const slot = slots[slotIndex]
  return (
    <div className='popover' style={{ position: 'relative' }}>
      <fieldset className={styles.colorGrid}>
        <legend className='sr-only'>
          <Trans>Options de couleur</Trans>
        </legend>
        {fullPalette.map((pc: CPCColor, optionIndex: number) => {
          return (
            <div key={pc.hex}>
              {/* @sonar-ignore-next-line a11y/useSemanticElements: Custom color option with visual display */}
              <ColorButton
                colorHex={`#${pc.hex}`}
                className={styles.colorOption}
                title={pc.name}
                aria-selected={focusedColorIndex === optionIndex}
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
      </fieldset>
      {/* Affiche les boutons uniquement si le slot est rempli */}
      {slot.color && (
        <div className={styles.actionButtons}>
          <Button
            className={styles.actionButton}
            variant='secondary'
            onClick={() => {
              onToggleLock(slotIndex)
              onClose()
            }}
          >
            {slot.locked ? (
              <Trans>Déverrouiller</Trans>
            ) : (
              <Trans>Verrouiller</Trans>
            )}
          </Button>
          {onClearSlot && (
            <Button
              className={styles.actionButton}
              variant='secondary'
              onClick={() => {
                onClearSlot(slotIndex)
                onClose()
              }}
            >
              <Trans>Vider</Trans>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
