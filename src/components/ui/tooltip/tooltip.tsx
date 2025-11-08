import type { ReactNode } from 'react'
import styles from './tooltip.module.css'

export interface TooltipProps {
  readonly children: ReactNode
  readonly content: ReactNode
  readonly position?: 'top' | 'bottom' | 'left' | 'right'
  readonly variant?: 'default' | 'success' | 'error' | 'warning'
  readonly showArrow?: boolean
  readonly className?: string
}

/**
 * Tooltip component unifié pour toute l'application
 * Remplace les tooltips HTML natifs (title) pour un style cohérent
 *
 * @example
 * <Tooltip content="Click to copy">
 *   <button>Copy</button>
 * </Tooltip>
 */
export function Tooltip({
  children,
  content,
  position = 'top',
  variant = 'default',
  showArrow = true,
  className = ''
}: TooltipProps) {
  const tooltipClasses = [
    styles.tooltip,
    variant !== 'default' && styles[variant],
    className
  ]
    .filter(Boolean)
    .join(' ')

  const contentClasses = [styles.tooltipContent, styles[position]]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={tooltipClasses}>
      {children}
      <span className={contentClasses} role='tooltip'>
        {content}
        {showArrow && <span className={styles.arrow} />}
      </span>
    </span>
  )
}
