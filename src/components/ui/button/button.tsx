import { Slot } from '@radix-ui/react-slot'
import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './button.module.css'

type Variant = 'primary' | 'secondary' | 'icon'

type Props = {
  children: ReactNode
  asChild?: boolean
  variant?: Variant
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export default function Button({
  children,
  asChild = false,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}: Props) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
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
    </Comp>
  )
}
