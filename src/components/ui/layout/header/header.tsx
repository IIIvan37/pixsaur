import Button from '../../button'
import Icon from '../../icon'
import styles from './header.module.css'

import type { IconName } from '../../icon'

export type HeaderProps = {
  title?: string
  actionLabel?: string
  action?: () => void
  icon?: IconName
  disabled?: boolean
}

export function Header({
  title,
  action,
  actionLabel = '',
  icon,
  disabled = false
}: HeaderProps) {
  return (
    <div className={styles.sectionHeader}>
      {!!title && <h1 className={styles.sectionTitle}>{title}</h1>}
      {!!action && (
        <Button
          disabled={disabled}
          variant='secondary'
          className={styles.headerButton}
          aria-label={actionLabel}
          onClick={action}
        >
          {icon && <Icon name={icon} className={styles.buttonIcon} />}
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
