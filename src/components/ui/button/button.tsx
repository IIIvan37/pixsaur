import type { ReactNode, ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './button.module.css'

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'icon'
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  variant = 'primary',
  disabled = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type='button'
      className={clsx(
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
