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
  variant?: 'default' | 'unstyled' // Variant au lieu de boolean
}

export default function PixsaurPopover({
  open,
  onOpenChange,
  trigger,
  children,
  side = 'right',
  align = 'center',
  sideOffset = 8,
  collisionPadding = 8,
  variant = 'default'
}: Readonly<Props>) {
  const isUnstyled = variant === 'unstyled'
  
  // Debug log removed
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={isUnstyled ? styles.unstyled : styles.popover}
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={{
            left: collisionPadding,
            right: collisionPadding,
            top: collisionPadding,
            bottom: collisionPadding
          }}
          avoidCollisions={true}
          // onInteractOutside désactivé pour test
        >
          {children}
          {!isUnstyled && <Popover.Arrow className={styles.arrow} />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
