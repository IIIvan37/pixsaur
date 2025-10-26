import type { ReactNode } from 'react'
import Button from '../../button'
import type { IconName } from '../../icon'
import Icon from '../../icon'
import styles from './header.module.css'

export type HeaderProps = {
  readonly title?: ReactNode
  readonly actionLabel?: ReactNode
  readonly action?: () => void
  readonly icon?: IconName
  readonly disabled?: boolean
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
          aria-label={typeof actionLabel === 'string' ? actionLabel : undefined}
          onClick={action}
        >
          {icon && <Icon name={icon} className={styles.buttonIcon} />}
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
