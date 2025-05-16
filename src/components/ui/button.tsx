'use client'

import type { ReactNode } from 'react'
import { Button as RadixButton } from '@radix-ui/themes'
import styles from '@/styles/ui/button.module.css'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'reset' | 'icon'
  disabled?: boolean
  className?: string
  title?: string
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
  'aria-pressed'?: boolean
  'aria-disabled'?: boolean
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  title,
  type = 'button',
  ...props
}: ButtonProps) {
  // Map our variants to Radix variants
  const getRadixVariant = () => {
    switch (variant) {
      case 'primary':
        return 'solid'
      case 'secondary':
        return 'outline'
      case 'reset':
        return 'soft'
      case 'icon':
        return 'ghost'
      default:
        return 'solid'
    }
  }

  return (
    <RadixButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${styles[variant]} ${
        disabled ? styles.disabled : ''
      } ${className}`}
      title={title}
      variant={getRadixVariant()}
      color='green'
      {...props}
    >
      {children}
    </RadixButton>
  )
}
