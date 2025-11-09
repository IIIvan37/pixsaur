import clsx from 'clsx'
// ...existing code...
import { forwardRef } from 'react'
import Icon from '@/components/ui/icon'
import { isBright } from '@/libs/pixsaur-color/src/quant/select-contrast-subset'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { vectorToHex } from '@/palettes/cpc-palette'
import { ColorButton } from './color-button'
import styles from './color-slot.module.css'

type ColorSlotProps = {
  color: Vector<'RGB'>
  locked: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onOpenPopover?: () => void
  focused?: boolean
  occurrenceCount?: number
}

export const ColorSlot = forwardRef<HTMLButtonElement, ColorSlotProps>(
  (
    { color, locked, buttonRef, onOpenPopover, focused, occurrenceCount },
    ref
  ) => {
    const hex = vectorToHex(color)

    // Build tooltip with hex color and occurrence count
    let tooltip = `#${hex} ${locked ? 'verrouillée' : 'déverrouillée'}`
    if (occurrenceCount !== undefined) {
      const formattedCount =
        occurrenceCount === 0
          ? '0 pixel'
          : occurrenceCount === 1
            ? '1 pixel'
            : occurrenceCount >= 1000000
              ? `${(occurrenceCount / 1000000).toFixed(1)}M pixels`
              : occurrenceCount >= 1000
                ? `${(occurrenceCount / 1000).toFixed(1)}k pixels`
                : `${occurrenceCount} pixels`
      tooltip += ` - ${formattedCount}`
    }

    return (
      <ColorButton
        ref={ref}
        colorHex={`#${hex}`}
        className={styles.colorFill}
        title={tooltip}
        aria-selected={focused ? 'true' : 'false'}
        buttonRef={buttonRef}
        onClick={onOpenPopover ? () => onOpenPopover() : undefined}
      >
        {locked && (
          <span className={styles.lockOverlay} aria-hidden='true'>
            <Icon
              name='LockClosedIcon'
              className={clsx(
                styles.lockIcon,
                isBright(color) ? styles.lockIconDark : styles.lockIconLight
              )}
            />
          </span>
        )}
      </ColorButton>
    )
  }
)
