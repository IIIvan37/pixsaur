'use client'

import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import styles from './dialog.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

export default function PixsaurDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer
}: Readonly<Props>) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          {description && (
            <Dialog.Description className={styles.description}>
              {description}
            </Dialog.Description>
          )}
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
          <Dialog.Close className={styles.closeButton} aria-label='Close'>
            ×
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
