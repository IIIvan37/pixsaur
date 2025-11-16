import clsx from 'clsx'
import type React from 'react'
import { useMemo } from 'react'
import Icon from '@/components/ui/icon'
import { isBright } from '@/libs/pixsaur-color/src/quant/select-contrast-subset'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { vectorToHex } from '@/palettes/cpc-palette'
import { ColorButton } from './color-button'
import styles from './color-slot.module.css'

/**
 * Format occurrence count for display in tooltips
 */
export const formatOccurrenceCount = (count: number): string => {
  if (count === 0) return '0 pixel'
  if (count === 1) return '1 pixel'
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M pixels`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k pixels`
  return `${count} pixels`
}

type ColorSlotProps = {
  color: Vector<'RGB'>
  locked: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onOpenPopover?: () => void
  focused?: boolean
  occurrenceCount?: number
}

export const ColorSlot: React.FC<ColorSlotProps> = ({
  color,
  locked,
  buttonRef,
  onOpenPopover,
  focused,
  occurrenceCount
}) => {
  const hex = vectorToHex(color)

  // Build tooltip with hex color and occurrence count
  const tooltip = useMemo(() => {
    let result = `#${hex} ${locked ? 'verrouillée' : 'déverrouillée'}`
    if (occurrenceCount !== undefined) {
      result += ` - ${formatOccurrenceCount(occurrenceCount)}`
    }
    return result
  }, [hex, locked, occurrenceCount])

  return (
    <ColorButton
      colorHex={`#${hex}`}
      className={styles.colorFill}
      title={tooltip}
      aria-pressed={focused}
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
