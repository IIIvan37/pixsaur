import React from 'react'
import clsx from 'clsx'
import styles from './color-button.module.css'

type ColorButtonProps = {
  colorHex: string
  className?: string
  title?: string
  role?: string
  ariaSelected?: boolean
  disabled?: boolean
  tabIndex?: number
  onClick?: () => void
  buttonRef?: (el: HTMLButtonElement | null) => void
  children?: React.ReactNode
}

export const ColorButton: React.FC<ColorButtonProps> = ({
  colorHex,
  className,
  title,
  role,
  ariaSelected,
  disabled,
  tabIndex,
  onClick,
  buttonRef,
  children
}) => (
  <button
    ref={buttonRef}
    className={clsx(styles.colorButton, className)}
    style={{ backgroundColor: colorHex }}
    title={title}
    role={role}
    aria-selected={ariaSelected}
    disabled={disabled}
    tabIndex={tabIndex}
    onClick={onClick}
    type='button'
  >
    {children}
  </button>
)
