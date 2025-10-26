import clsx from 'clsx'
import type React from 'react'
import { forwardRef } from 'react'
import styles from './color-button.module.css'

type ColorButtonProps = {
  colorHex: string
  className?: string
  title?: string
  role?: string
  disabled?: boolean
  tabIndex?: number
  onClick?: () => void
  buttonRef?: (el: HTMLButtonElement | null) => void
  children?: React.ReactNode
}

export const ColorButton = forwardRef<HTMLButtonElement, ColorButtonProps>(
  (
    {
      colorHex,
      className,
      title,
      role,
      disabled,
      tabIndex,
      onClick,
      buttonRef,
      children
    },
    ref
  ) => (
    <button
      ref={(el) => {
        if (buttonRef) buttonRef(el)
        if (typeof ref === 'function') ref(el)
        else if (ref && 'current' in ref) ref.current = el
      }}
      className={clsx(styles.colorButton, className)}
      style={{ backgroundColor: colorHex }}
      title={title}
      role={role}
      disabled={disabled}
      tabIndex={tabIndex}
      onClick={onClick}
      type='button'
    >
      {children}
    </button>
  )
)
