import { useEffect } from 'react'
import Icon from '../icon'
import PixsaurPopover from '../popover/popover'
import styles from './notification.module.css'

export interface NotificationProps {
  message: string
  type?: 'success' | 'error' | 'info'
  open: boolean
  onOpenChange: (open: boolean) => void
  autoCloseDuration?: number // in milliseconds, 0 to disable
}

/**
 * Notification Component
 * Displays a notification popover similar to the updater notification
 */
export const Notification = ({
  message,
  type = 'success',
  open,
  onOpenChange,
  autoCloseDuration = 3000
}: NotificationProps) => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (open && autoCloseDuration > 0) {
      timer = setTimeout(() => {
        onOpenChange(false)
      }, autoCloseDuration)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [open, autoCloseDuration, onOpenChange])

  const getIcon = () => {
    switch (type) {
      case 'error':
        return 'Cross2Icon'
      case 'info':
        return 'InfoCircledIcon'
      default:
        return 'InfoCircledIcon'
    }
  }

  return (
    <div className={styles.notificationContainer}>
      <PixsaurPopover
        open={open}
        onOpenChange={onOpenChange}
        trigger={<div style={{ display: 'none' }} />}
        side='bottom'
        align='end'
        sideOffset={12}
        variant='unstyled'
      >
        <div
          className={`${styles.notificationContent} ${styles[type]}`}
          role={type === 'error' ? 'alert' : undefined}
          aria-live={type === 'error' ? 'assertive' : 'polite'}
        >
          <div className={styles.notificationHeader}>
            <Icon name={getIcon()} size={20} className={styles.icon} />
            <p className={styles.message}>{message}</p>
          </div>
        </div>
      </PixsaurPopover>
    </div>
  )
}
