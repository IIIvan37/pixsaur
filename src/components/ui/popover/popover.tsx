'use client'

import * as Popover from '@radix-ui/react-popover'
import type { ReactNode } from 'react'
import styles from './popover.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'center' | 'start' | 'end'
  sideOffset?: number
  collisionPadding?: number
}

export default function PixsaurPopover({
  open,
  onOpenChange,
  trigger,
  children,
  side = 'right',
  align = 'center',
  sideOffset = 8,
  collisionPadding = 8
}: Props) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={{
            left: collisionPadding,
            right: collisionPadding,
            top: collisionPadding,
            bottom: collisionPadding
          }}
          avoidCollisions={false}
          onInteractOutside={() => {
            onOpenChange(false)
          }}
        >
          {children}
          <Popover.Arrow className={styles.arrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
