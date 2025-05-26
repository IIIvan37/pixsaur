import React from 'react'
import styles from './color-slot.module.css'
import Icon from '@/components/ui/icon'
import { isBright } from '@/libs/pixsaur-color/src/quant/select-contrast-subset'
import { Vector } from '@/libs/pixsaur-color/src/type'

import clsx from 'clsx'
import { ColorButton } from './color-button'
import { vectorToHex } from '@/palettes/cpc-palette'

type ColorSlotProps = {
  idx: number
  color: Vector<'RGB'>
  locked: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onToggleLock: (idx: number) => void
}

export const ColorSlot: React.FC<ColorSlotProps> = ({
  idx,
  color,
  locked,
  buttonRef,
  onToggleLock
}) => {
  const hex = vectorToHex(color)

  return (
    <ColorButton
      colorHex={`#${hex}`}
      className={styles.colorFill}
      title={`#${hex} ${locked ? 'verrouillée' : 'déverrouillée'}`}
      ariaSelected={undefined}
      buttonRef={buttonRef}
      onClick={() => onToggleLock(idx)}
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
